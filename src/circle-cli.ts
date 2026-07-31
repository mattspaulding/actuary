import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class CircleCliError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
    /** Structured error code from the CLI's JSON output, when present. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CircleCliError';
  }
}

/** Pull `{error: {code, message}}` out of a failed CLI run's stdout. */
function parseCliError(stdout: string): { code?: string; message?: string } {
  const start = stdout.indexOf('{');
  if (start === -1) return {};
  try {
    const parsed = JSON.parse(stdout.slice(start)) as {
      error?: { code?: string; message?: string };
    };
    return parsed.error ?? {};
  } catch {
    return {};
  }
}

/**
 * Run the locally installed Circle CLI and parse its JSON envelope.
 *
 * Auth and Terms state live in the CLI's own config (created when the human
 * operator runs `circle terms accept` and `circle wallet login`). This wrapper
 * never sets CIRCLE_ACCEPT_TERMS itself — accepting Circle's Terms of Use is
 * the operator's decision, not the agent's.
 */
export async function circleJson<T>(
  args: string[],
  { timeoutMs = 120_000 }: { timeoutMs?: number } = {},
): Promise<T> {
  try {
    const { stdout } = await execFileAsync(
      'npx',
      ['circle', ...args, '--output', 'json'],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
    );
    // The CLI wraps payloads in a `{ data: ... }` envelope; tolerate both.
    const start = stdout.indexOf('{');
    if (start === -1) throw new CircleCliError('No JSON in CLI output', stdout);
    const parsed = JSON.parse(stdout.slice(start)) as { data?: T } & T;
    return (parsed.data ?? parsed) as T;
  } catch (err) {
    if (err instanceof CircleCliError) throw err;
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const structured = parseCliError(e.stdout ?? '');
    throw new CircleCliError(
      structured.message ?? e.message ?? 'circle CLI failed',
      e.stderr ?? '',
      structured.code,
    );
  }
}

/**
 * Envelope from `circle services pay --output json` (after the `{data}`
 * unwrap): a paid call carries `response` + `payment`; a free 2xx carries
 * `response` + a "no payment required" `message` and no `payment`.
 */
export interface PayResult {
  response?: unknown;
  message?: string;
  payment?: {
    /** e.g. "$0.001 USDC" */
    amount?: string;
    chain?: string;
    scheme?: string;
    seller?: string;
    /** Base64 settlement receipt containing the transaction reference. */
    receipt?: string;
  };
  [k: string]: unknown;
}

/** Parse "$0.001 USDC" (or "0.001") into a number of USDC. */
export function parsePaymentAmountUsdc(amount?: string): number | null {
  if (!amount) return null;
  const m = amount.match(/([0-9]*\.?[0-9]+)/);
  return m ? Number(m[1]) : null;
}

/** Extract the settlement transaction reference from a payment receipt. */
export function parseReceiptTxRef(receipt?: string): string | undefined {
  if (!receipt) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(receipt, 'base64').toString('utf8')) as {
      transaction?: string;
    };
    return decoded.transaction;
  } catch {
    return undefined;
  }
}

/**
 * Make a paid request via `circle services pay`, capped by --max-amount.
 * The wallet's own spending policy is the hard backstop behind this cap.
 */
export async function servicesPay(input: {
  url: string;
  address: string;
  chain: string;
  method?: string;
  data?: string;
  maxAmountUsdc: number;
  timeoutSec?: number;
}): Promise<PayResult> {
  const args = [
    'services',
    'pay',
    input.url,
    '--address',
    input.address,
    '--chain',
    input.chain,
    '--max-amount',
    String(input.maxAmountUsdc),
    '--timeout',
    String(input.timeoutSec ?? 30),
  ];
  if (input.method) args.push('-X', input.method);
  if (input.data) args.push('-d', input.data);
  return circleJson<PayResult>(args, { timeoutMs: 90_000 });
}
