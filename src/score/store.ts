import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import type { ProbeResult } from '../types.ts';

const PROBES_FILE = () => path.join(config.dataDir, 'probes.jsonl');
const SPEND_FILE = () => path.join(config.dataDir, 'spend.json');

function ensureDataDir(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

export function appendProbe(result: ProbeResult): void {
  ensureDataDir();
  fs.appendFileSync(PROBES_FILE(), JSON.stringify(result) + '\n');
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
    return 0;
  }
}

export function recordSpend(usdc: number): void {
  ensureDataDir();
  const next: SpendLedger = {
    date: todayUtc(),
    spentUsdc: spentTodayUsdc() + usdc,
  };
  fs.writeFileSync(SPEND_FILE(), JSON.stringify(next, null, 2));
}
