import express from 'express';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import { config } from '../config.ts';
import { computeScores } from '../score/compute.ts';
import { appendEarning, loadEarnings, loadProbes } from '../score/store.ts';
import type { ServiceScore } from '../types.ts';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

/**
 * The paid route is the business: agents pay $0.001 in USDC (via Circle
 * Gateway batching) to ask "does this service actually work this week?"
 * before spending 10-300x that on the service itself.
 */
const gateway = config.sellerAddress
  ? createGatewayMiddleware({
      sellerAddress: config.sellerAddress,
      facilitatorUrl: config.facilitatorUrl,
    })
  : null;

if (gateway) {
  // Every settled lookup goes into the earnings ledger — the revenue-side
  // twin of probes.jsonl, and the judges' evidence that agents pay us.
  gateway.onAfterSettle(async (ctx) => {
    const settle = ctx as {
      result?: { payer?: string; transaction?: string; network?: string };
    };
    appendEarning({
      ts: new Date().toISOString(),
      priceUsdc: config.scorePriceUsdc,
      payer: settle.result?.payer,
      network: settle.result?.network,
      transaction: settle.result?.transaction,
    });
  });
} else if (isProduction) {
  console.error(
    '[actuary] FATAL: SELLER_ADDRESS is required in production — the paid endpoint must never silently become free.',
  );
  process.exit(1);
} else {
  console.warn(
    '[actuary] SELLER_ADDRESS not set — /v1/score is UNPAID (local dev only).',
  );
}

const paid = gateway ? gateway.require(`$${config.scorePriceUsdc}`) : null;

/** computeScores re-reads the whole JSONL; cache briefly for request bursts. */
let scoreCache: { at: number; scores: ServiceScore[] } | null = null;
function scores(): ServiceScore[] {
  if (!scoreCache || Date.now() - scoreCache.at > 30_000) {
    scoreCache = { at: Date.now(), scores: computeScores() };
  }
  return scoreCache.scores;
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

/** Free teaser: grades only. The detail behind each grade is the paid product. */
app.get('/v1/scores', (_req, res) => {
  res.json({
    updated: new Date().toISOString(),
    windowDays: config.scoreWindowDays,
    agentWallet: config.probeWalletAddress || undefined,
    services: scores().map((s) => ({
      resource: s.resource,
      provider: s.provider,
      grade: s.grade,
      samples: s.samples,
      lastProbe: s.lastProbe,
    })),
  });
});

/**
 * Known-service gate runs BEFORE the payment middleware: a buyer must never
 * pay $0.001 to be told 404. Unknown services answer free.
 */
const knownServiceGate: express.RequestHandler = (req, res, next) => {
  const url = String(req.query.url ?? '');
  if (!url) {
    res.status(400).json({ error: 'Pass ?url=<service resource URL>' });
    return;
  }
  if (!scores().some((s) => s.resource === url)) {
    res.status(404).json({
      error: 'Service not yet probed — no charge',
      hint: 'It will enter the index on the next probe round.',
    });
    return;
  }
  next();
};

/** Paid detail: the full scorecard for one service. */
const scoreHandler: express.RequestHandler = (req, res) => {
  const url = String(req.query.url ?? '');
  const score = scores().find((s) => s.resource === url);
  if (!score) {
    // The index rotated between gate and handler; still never charge-for-404.
    res.status(404).json({ error: 'Service not yet probed' });
    return;
  }
  res.json({ ...score, unpaidDevMode: paid ? undefined : true });
};

if (paid) {
  app.get('/v1/score', knownServiceGate, paid, scoreHandler);
} else {
  app.get('/v1/score', knownServiceGate, scoreHandler);
}

/** Human-readable leaderboard. */
app.get('/', (_req, res) => {
  const board = scores();
  const probes = loadProbes();
  const earnings = loadEarnings();
  const paidSpend = probes.reduce((s, p) => s + (p.paidUsdc ?? 0), 0);
  const earned = earnings.reduce((s, e) => s + e.priceUsdc, 0);
  const explorer = config.probeWalletAddress
    ? `https://explorer-testnet.arc.network/address/${config.probeWalletAddress}`
    : null;
  const rows = board
    .map(
      (s) => `<tr>
        <td class="g g${s.grade}">${s.grade}</td>
        <td>${s.composite}</td>
        <td>${escapeHtml(s.provider)}</td>
        <td class="r">${escapeHtml(s.resource)}</td>
        <td>${Math.round(s.uptime * 100)}%</td>
        <td>${s.latencyP50Ms ?? '—'}</td>
        <td>${s.samples}</td>
      </tr>`,
    )
    .join('\n');
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Actuary — the agent economy, measured</title>
<style>
  body{font-family:ui-monospace,Menlo,monospace;margin:40px auto;max-width:980px;padding:0 16px;background:#0e141b;color:#dbe4ee}
  h1{font-size:20px} .sub{color:#7d8ea0} a{color:#5b9be0}
  table{border-collapse:collapse;width:100%;margin-top:24px;font-size:13px}
  th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #223041}
  th{color:#7d8ea0;text-transform:uppercase;font-size:11px;letter-spacing:.08em}
  .r{color:#7d8ea0;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .g{font-weight:700}.gA{color:#4cbb94}.gB{color:#9fd356}.gC{color:#e0c04c}.gD{color:#e08a4c}.gF{color:#e05c5c}
</style></head><body>
<h1>ACTUARY <span class="sub">— the agent economy, measured</span></h1>
<p class="sub">${board.length} services scored · ${probes.length} probes on record · ${paidSpend.toFixed(4)} USDC spent probing · ${earned.toFixed(4)} USDC earned from ${earnings.length} lookups · window ${config.scoreWindowDays}d</p>
${explorer ? `<p class="sub">agent wallet: <a href="${explorer}">${config.probeWalletAddress}</a></p>` : ''}
<table><tr><th>Grade</th><th>Score</th><th>Provider</th><th>Endpoint</th><th>Uptime</th><th>p50 ms</th><th>Samples</th></tr>
${rows || '<tr><td colspan="7">No probe data yet — run <code>npm run probe</code>.</td></tr>'}
</table>
<p class="sub">Detailed scorecards: <code>GET /v1/score?url=…</code> — $${config.scorePriceUsdc} USDC via x402/Circle Gateway.</p>
</body></html>`);
});

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

app.listen(config.port, () => {
  console.log(`[actuary] score API listening on :${config.port}`);
});
