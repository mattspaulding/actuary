import { config, probeCaip2, CHAIN_TO_CAIP2 } from '../config.ts';
import { discoverServices, priceOnChainUsdc } from '../discovery.ts';
import {
  CircleCliError,
  parsePaymentAmountUsdc,
  parseReceiptTxRef,
  servicesPay,
} from '../circle-cli.ts';
import {
  acquireRoundLock,
  appendProbe,
  recordSpend,
  releaseRoundLock,
  spentTodayUsdc,
} from '../score/store.ts';
import { gradeResponse } from './grade.ts';
import type {
  ProbeMode,
  ProbeOutcome,
  ProbeResult,
  ServiceListing,
} from '../types.ts';

/**
 * Estimate-mode probe: request the endpoint WITHOUT payment and inspect the
 * x402 402 challenge. Free, wallet-less, and still a real liveness +
 * protocol-conformance measurement. This is what lets the fleet start
 * accumulating history before the wallet even exists.
 */
async function probeEstimate(
  service: ServiceListing,
): Promise<Pick<ProbeResult, 'outcome' | 'latencyMs' | 'httpStatus' | 'error'>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.probeTimeoutMs);
  const started = performance.now();
  const bodiless = service.method === 'GET' || service.method === 'HEAD';
  try {
    const res = await fetch(service.resource, {
      method: service.method,
      signal: controller.signal,
      headers: bodiless
        ? { accept: 'application/json' }
        : { accept: 'application/json', 'content-type': 'application/json' },
      body: bodiless ? undefined : '{}',
    });
    // Read the body before stopping the clock so latency is a full round trip.
    const text = await res.text();
    const latencyMs = Math.round(performance.now() - started);

    if (res.status === 402) {
      const header = res.headers.get('payment-required');
      let challenge: unknown = null;
      try {
        challenge = header
          ? JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
          : JSON.parse(text);
      } catch {
        return { outcome: 'malformed', latencyMs, httpStatus: 402 };
      }
      const accepts = (challenge as { accepts?: unknown[] })?.accepts;
      const wellFormed = Array.isArray(accepts) && accepts.length > 0;
      return {
        outcome: wellFormed ? 'up_402' : 'malformed',
        latencyMs,
        httpStatus: 402,
      };
    }
    if (res.ok) return { outcome: 'up_free', latencyMs, httpStatus: res.status };
    return { outcome: 'http_error', latencyMs, httpStatus: res.status };
  } catch (err) {
    return {
      outcome: 'unreachable',
      latencyMs: Math.round(performance.now() - started),
      error: (err as Error).message.slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Failures on OUR side of a paid call (auth, balance, price cap, chain)
 * prove nothing about the service. They map to 'probe_error', which scoring
 * ignores — an expired login session must never read as a market-wide outage.
 */
const PROBE_SIDE_ERROR_CODES = new Set([
  'AUTH_REQUIRED',
  'UNAUTHENTICATED',
  'UNAUTHORIZED',
  'PERMISSION_DENIED',
  'INSUFFICIENT_FUNDS',
  'INSUFFICIENT_BALANCE',
  'INVALID_ARGUMENT',
]);

const PROBE_SIDE_ERROR_PATTERNS = [
  'exceeds --max-amount',
  'max-amount',
  'not logged in',
  'login',
  'session expired',
  'insufficient',
  'gateway balance',
  'terms acceptance',
];

/** The CLI may report the settlement went through even though the run failed. */
const PAYMENT_MAYBE_SUBMITTED_PATTERNS = [
  'payment may have been submitted',
  'payment submitted',
];

function classifyPaidError(err: CircleCliError): {
  outcome: ProbeOutcome;
  spendAnyway: boolean;
} {
  const text = `${err.message} ${err.stderr}`.toLowerCase();
  if (PAYMENT_MAYBE_SUBMITTED_PATTERNS.some((p) => text.includes(p))) {
    // Conservative: assume the money moved, and don't blame the service.
    return { outcome: 'probe_error', spendAnyway: true };
  }
  if (
    (err.code && PROBE_SIDE_ERROR_CODES.has(err.code)) ||
    PROBE_SIDE_ERROR_PATTERNS.some((p) => text.includes(p))
  ) {
    return { outcome: 'probe_error', spendAnyway: false };
  }
  // "Endpoint returned HTTP 500" and friends: the service answered badly.
  if (/http \d{3}/.test(text)) return { outcome: 'http_error', spendAnyway: false };
  return { outcome: 'unreachable', spendAnyway: false };
}

/** Paid-mode probe: actually buy the service via `circle services pay`. */
async function probePaid(
  service: ServiceListing,
  chainPriceUsdc: number,
): Promise<
  Pick<
    ProbeResult,
    | 'outcome'
    | 'latencyMs'
    | 'paidUsdc'
    | 'txRef'
    | 'schemaValid'
    | 'quality'
    | 'qualityRationale'
    | 'error'
  >
> {
  const bodiless = service.method === 'GET' || service.method === 'HEAD';
  const started = performance.now();
  try {
    const result = await servicesPay({
      url: service.resource,
      address: config.probeWalletAddress,
      chain: config.probeChain,
      method: bodiless ? undefined : service.method,
      data: bodiless ? undefined : '{}',
      maxAmountUsdc: Math.min(chainPriceUsdc, config.maxPerCallUsdc),
    });
    const latencyMs = Math.round(performance.now() - started);

    // A 2xx without a 402 challenge means no money moved: that's a free
    // response, not a purchase, and must not touch the spend ledger.
    if (!result.payment) {
      return { outcome: 'up_free', latencyMs, paidUsdc: 0 };
    }

    const paidUsdc =
      parsePaymentAmountUsdc(result.payment.amount) ?? chainPriceUsdc;
    recordSpend(paidUsdc);

    const body = result.response;
    const schemaValid =
      body !== undefined && body !== null && typeof body === 'object';
    const grade = await gradeResponse(service, body);
    return {
      outcome: 'up_paid',
      latencyMs,
      paidUsdc,
      txRef: parseReceiptTxRef(result.payment.receipt),
      schemaValid,
      quality: grade.quality,
      qualityRationale: grade.rationale,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const base = {
      latencyMs,
      error: (err as Error).message.slice(0, 200),
    };
    if (err instanceof CircleCliError) {
      const { outcome, spendAnyway } = classifyPaidError(err);
      if (spendAnyway) recordSpend(chainPriceUsdc);
      return { outcome, ...base };
    }
    return { outcome: 'unreachable', ...base };
  }
}

async function runRound(mode: ProbeMode): Promise<void> {
  console.log(`[actuary] discovering services (mode=${mode})…`);
  let services = await discoverServices({
    maxPriceUsdc: config.maxPerCallUsdc,
  });
  console.log(`[actuary] ${services.length} services within price cap`);

  const caip2 = probeCaip2();
  if (mode === 'paid') {
    if (!config.probeWalletAddress) {
      throw new Error(
        'PROBE_WALLET_ADDRESS is not set. Run `circle wallet login` first (see README), or run estimate mode: npm run probe',
      );
    }
    if (!caip2) {
      throw new Error(
        `Unknown PROBE_CHAIN "${config.probeChain}". Valid: ${Object.keys(CHAIN_TO_CAIP2).join(', ')}`,
      );
    }
    services = services.filter((s) => {
      const price = priceOnChainUsdc(s.accepts, caip2);
      return price !== null && price <= config.maxPerCallUsdc;
    });
    console.log(
      `[actuary] ${services.length} services payable on ${config.probeChain}`,
    );
  }

  if (services.length === 0) {
    // Zero probe-able services is a broken fleet, not a quiet success —
    // fail loudly so launchd logs show red instead of weeks of silence.
    throw new Error(
      `0 probe-able services (mode=${mode}, chain=${config.probeChain}). Discovery shape change, chain typo, or empty marketplace — investigate.`,
    );
  }

  services = services.slice(0, config.maxServicesPerRound);
  let done = 0;
  let probeErrors = 0;
  let gradeFailures = 0;
  for (const service of services) {
    // Budget gate before every paid call — the soft belt inside the code;
    // the wallet's spending policy is the hard backstop outside it.
    let effectiveMode: ProbeMode = mode;
    const chainPrice = caip2 ? priceOnChainUsdc(service.accepts, caip2) : null;
    if (mode === 'paid') {
      const price = chainPrice ?? config.maxPerCallUsdc;
      if (spentTodayUsdc() + price > config.dailyBudgetUsdc) {
        console.log(
          `[actuary] daily budget ${config.dailyBudgetUsdc} USDC reached — falling back to estimate probes`,
        );
        effectiveMode = 'estimate';
      }
    }

    const base =
      effectiveMode === 'paid'
        ? await probePaid(service, chainPrice ?? config.maxPerCallUsdc)
        : await probeEstimate(service);
    const result: ProbeResult = {
      ts: new Date().toISOString(),
      resource: service.resource,
      provider: service.provider.name ?? 'unknown',
      category: service.provider.category ?? 'UNCATEGORIZED',
      mode: effectiveMode,
      ...base,
    };
    appendProbe(result);
    done += 1;
    if (result.outcome === 'probe_error') probeErrors += 1;
    if (result.mode === 'paid' && result.quality === null) gradeFailures += 1;
    console.log(
      `[actuary] ${done}/${services.length} ${result.outcome.padEnd(11)} ${result.latencyMs}ms ${service.resource}`,
    );
  }
  console.log(
    `[actuary] round complete: ${done} probes, ${probeErrors} probe-side errors, ${gradeFailures} grading gaps, ${spentTodayUsdc().toFixed(4)} USDC spent today`,
  );
  if (probeErrors === done) {
    // Every probe failing on OUR side (expired session, empty Gateway
    // balance) deserves a red exit, not a green "round complete".
    throw new Error(
      'Every probe in the round failed probe-side — check `circle wallet status` and Gateway balance.',
    );
  }
}

async function runOnce(mode: ProbeMode): Promise<void> {
  if (!acquireRoundLock()) {
    console.log('[actuary] another round is already running — skipping this fire');
    return;
  }
  try {
    await runRound(mode);
  } finally {
    releaseRoundLock();
  }
}

async function main(): Promise<void> {
  const mode: ProbeMode = process.argv.includes('--paid') ? 'paid' : 'estimate';
  const loop = process.argv.includes('--loop');
  if (!loop) {
    await runOnce(mode);
    return;
  }
  // Container mode (Cloud Run + RUN_MODE=probe-loop): keep the process alive
  // and run rounds on an interval; one failed round logs and waits, it never
  // kills the fleet.
  const intervalMs = Number(process.env.PROBE_INTERVAL_MS) || 30 * 60 * 1000;
  for (;;) {
    try {
      await runOnce(mode);
    } catch (err) {
      console.error('[actuary] round failed:', (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((err) => {
  console.error('[actuary] round failed:', err.message);
  process.exit(1);
});
