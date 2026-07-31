import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader so scheduled runs (launchd, cron) behave like dev shells.
// Real environment variables always win over file values.
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trimStart().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

/** CLI chain name → CAIP-2 network id (Circle Agent Wallet chains). */
export const CHAIN_TO_CAIP2: Record<string, string> = {
  BASE: 'eip155:8453',
  'BASE-SEPOLIA': 'eip155:84532',
  ETH: 'eip155:1',
  'ETH-SEPOLIA': 'eip155:11155111',
  ARB: 'eip155:42161',
  AVAX: 'eip155:43114',
  OP: 'eip155:10',
  MATIC: 'eip155:137',
  UNI: 'eip155:130',
  MONAD: 'eip155:143',
  ARC: 'eip155:5042',
  'ARC-TESTNET': 'eip155:5042002',
};

function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  rootDir: root,
  dataDir: path.join(root, 'data'),

  // Buyer / probe side
  probeWalletAddress: process.env.PROBE_WALLET_ADDRESS ?? '',
  probeChain: process.env.PROBE_CHAIN ?? 'ARC-TESTNET',
  maxPerCallUsdc: num('MAX_PER_CALL_USDC', 0.05),
  dailyBudgetUsdc: num('DAILY_BUDGET_USDC', 2.0),
  /** Max services probed per round; keeps a round bounded. */
  maxServicesPerRound: num('MAX_SERVICES_PER_ROUND', 40),
  probeTimeoutMs: num('PROBE_TIMEOUT_MS', 15_000),

  // Seller / score API side
  sellerAddress: process.env.SELLER_ADDRESS ?? '',
  scorePriceUsdc: num('SCORE_PRICE_USDC', 0.001),
  port: num('PORT', 8080),
  /** Gateway facilitator. Testnet by default; switch for mainnet earnings. */
  facilitatorUrl:
    process.env.FACILITATOR_URL ?? 'https://gateway-api-testnet.circle.com',

  // Grading
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  // Scoring window
  scoreWindowDays: num('SCORE_WINDOW_DAYS', 14),
};

export const probeCaip2 = (): string | undefined =>
  CHAIN_TO_CAIP2[config.probeChain.toUpperCase()];
