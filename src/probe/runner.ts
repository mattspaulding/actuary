import { config, probeCaip2 } from '../config.ts';
import { discoverServices } from '../discovery.ts';
import { servicesPay } from '../circle-cli.ts';
import { appendProbe, recordSpend, spentTodayUsdc } from '../score/store.ts';
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
  try {
    const res = await fetch(service.resource, {
      method: service.method,
      signal: controller.signal,
      headers:
        service.method === 'GET'
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: service.method === 'GET' ? undefined : '{}',
    });
    const latencyMs = Math.round(performance.now() - started);
    // Read (and discard) the body so latency reflects a full round trip.
    const text = await res.text();

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

/** Paid-mode probe: actually buy the service via `circle services pay`. */
async function probePaid(
  service: ServiceListing,
): Promise<
  Pick<
    ProbeResult,
    | 'outcome'
    | 'latencyMs'
    | 'paidUsdc'
    | 'schemaValid'
    | 'quality'
    | 'qualityRationale'
    | 'error'
  >
> {
  const price = service.minPriceUsdc ?? config.maxPerCallUsdc;
  const started = performance.now();
  try {
    const result = await servicesPay({
      url: service.resource,
      address: config.probeWalletAddress,
      chain: config.probeChain,
      method: service.method === 'GET' ? undefined : service.method,
      data: service.method === 'GET' ? undefined : '{}',
      maxAmountUsdc: Math.min(price, config.maxPerCallUsdc),
    });
    const latencyMs = Math.round(performance.now() - started);
    recordSpend(price);

    const body = result.body ?? result;
    const schemaValid = typeof body === 'object' && body !== null;
    const grade = await gradeResponse(service, body);
    return {
      outcome: 'up_paid',
      latencyMs,
      paidUsdc: price,
      schemaValid,
      quality: grade.quality,
      qualityRationale: grade.rationale,
    };
  } catch (err) {
    return {
      outcome: 'unreachable',
      latencyMs: Math.round(performance.now() - started),
      error: (err as Error).message.slice(0, 200),
    };
  }
}

async function runRound(mode: ProbeMode): Promise<void> {
  console.log(`[actuary] discovering services (mode=${mode})…`);
  let services = await discoverServices({
    maxPriceUsdc: config.maxPerCallUsdc,
  });
  console.log(`[actuary] ${services.length} services within price cap`);

  if (mode === 'paid') {
    if (!config.probeWalletAddress) {
      throw new Error(
        'PROBE_WALLET_ADDRESS is not set. Run `circle wallet login` + `circle wallet create` first (see README), or run estimate mode: npm run probe',
      );
    }
    const caip2 = probeCaip2();
    services = services.filter((s) =>
      s.accepts.some((a) => a.network === caip2),
    );
    console.log(
      `[actuary] ${services.length} services payable on ${config.probeChain}`,
    );
  }

  services = services.slice(0, config.maxServicesPerRound);
  let done = 0;
  for (const service of services) {
    // Budget gate before every paid call — the soft belt inside the code;
    // the wallet's spending policy is the hard backstop outside it.
    let effectiveMode: ProbeMode = mode;
    if (mode === 'paid') {
      const price = service.minPriceUsdc ?? config.maxPerCallUsdc;
      if (spentTodayUsdc() + price > config.dailyBudgetUsdc) {
        console.log(
          `[actuary] daily budget ${config.dailyBudgetUsdc} USDC reached — falling back to estimate probes`,
        );
        effectiveMode = 'estimate';
      }
    }

    const base =
      effectiveMode === 'paid'
        ? await probePaid(service)
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
    console.log(
      `[actuary] ${done}/${services.length} ${result.outcome.padEnd(11)} ${result.latencyMs}ms ${service.resource}`,
    );
  }
  console.log(
    `[actuary] round complete: ${done} probes, ${spentTodayUsdc().toFixed(4)} USDC spent today`,
  );
}

const mode: ProbeMode = process.argv.includes('--paid') ? 'paid' : 'estimate';
runRound(mode).catch((err) => {
  console.error('[actuary] round failed:', err.message);
  process.exit(1);
});
