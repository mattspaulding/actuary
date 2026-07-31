import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class CircleCliError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'CircleCliError';
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
    const e = err as { stderr?: string; message?: string };
    throw new CircleCliError(e.message ?? 'circle CLI failed', e.stderr ?? '');
  }
}

export interface PayResult {
  status?: number;
  body?: unknown;
  payment?: { amount?: string; transaction?: string };
  [k: string]: unknown;
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
