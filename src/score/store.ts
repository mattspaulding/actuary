import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import type { ProbeResult } from '../types.ts';

const PROBES_FILE = () => path.join(config.dataDir, 'probes.jsonl');
const SPEND_FILE = () => path.join(config.dataDir, 'spend.json');
const EARNINGS_FILE = () => path.join(config.dataDir, 'earnings.jsonl');
const LOCK_FILE = () => path.join(config.dataDir, 'probe.lock');

/** Rotate probes.jsonl past this size; rotated files keep a date suffix. */
const ROTATE_BYTES = 20 * 1024 * 1024;

function ensureDataDir(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

/** Write via temp file + rename so a crash never leaves a torn JSON file. */
function writeAtomic(file: string, contents: string): void {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

export function appendProbe(result: ProbeResult): void {
  ensureDataDir();
  const file = PROBES_FILE();
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > ROTATE_BYTES) {
      fs.renameSync(file, `${file}.${new Date().toISOString().slice(0, 10)}`);
    }
  } catch {
    // Rotation is best-effort; never lose the observation over it.
  }
  fs.appendFileSync(file, JSON.stringify(result) + '\n');
}

export function loadProbes(sinceMs?: number): ProbeResult[] {
  const file = PROBES_FILE();
  if (!fs.existsSync(file)) return [];
  const out: ProbeResult[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const p = JSON.parse(line) as ProbeResult;
      if (sinceMs === undefined || Date.parse(p.ts) >= sinceMs) out.push(p);
    } catch {
      // A torn write on the final line is recoverable noise, not fatal.
    }
  }
  return out;
}

interface SpendLedger {
  /** UTC date string, e.g. "2026-07-30". */
  date: string;
  spentUsdc: number;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function spentTodayUsdc(): number {
  const file = SPEND_FILE();
  if (!fs.existsSync(file)) return 0;
  try {
    const ledger = JSON.parse(fs.readFileSync(file, 'utf8')) as SpendLedger;
    return ledger.date === todayUtc() ? ledger.spentUsdc : 0;
  } catch {
    // Fail closed: an unreadable ledger counts as the whole budget spent
    // for the rest of the day. Never hand back budget on corruption.
    return config.dailyBudgetUsdc;
  }
}

export function recordSpend(usdc: number): void {
  ensureDataDir();
  const next: SpendLedger = {
    date: todayUtc(),
    spentUsdc: spentTodayUsdc() + usdc,
  };
  writeAtomic(SPEND_FILE(), JSON.stringify(next, null, 2));
}

/** One sold score lookup, appended when the Gateway middleware settles. */
export interface EarningRecord {
  ts: string;
  priceUsdc: number;
  payer?: string;
  network?: string;
  transaction?: string;
  lookupUrl?: string;
}

export function appendEarning(record: EarningRecord): void {
  ensureDataDir();
  fs.appendFileSync(EARNINGS_FILE(), JSON.stringify(record) + '\n');
}

export function loadEarnings(): EarningRecord[] {
  const file = EARNINGS_FILE();
  if (!fs.existsSync(file)) return [];
  const out: EarningRecord[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as EarningRecord);
    } catch {
      // Skip torn final line.
    }
  }
  return out;
}

/** Stale-lock threshold; a round should never legitimately run this long. */
const LOCK_STALE_MS = 45 * 60 * 1000;

/**
 * Take the round lock. Returns false when another round is already running
 * (e.g. a manual `npm run probe` overlapping the launchd fire) so overlapping
 * rounds can't double-spend past the budget gate.
 */
export function acquireRoundLock(): boolean {
  ensureDataDir();
  const file = LOCK_FILE();
  try {
    if (fs.existsSync(file)) {
      const age = Date.now() - fs.statSync(file).mtimeMs;
      if (age < LOCK_STALE_MS) return false;
      fs.rmSync(file, { force: true });
    }
    fs.writeFileSync(file, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

export function releaseRoundLock(): void {
  try {
    fs.rmSync(LOCK_FILE(), { force: true });
  } catch {
    // Already gone.
  }
}
