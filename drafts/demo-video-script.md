# Actuary — demo video script (target 2:50, hard cap 3:00)

Compliance: public YouTube/Vimeo upload; MUST show at least one real,
verifiable USDC transaction on camera (Circle proof item); English.
Voiceover ≈ 420 words ≈ 2:45 at a natural pace. Record 1080p+, terminal at
18pt+, hide bookmarks bar, close notification sources before capture.

---

## 0:00–0:20 — Cold open: the counters (hook)

**Screen:** Leaderboard at actuary-….run.app. Zoom on the headline stats:
"__ days unattended · __ probes on record · __ USDC spent probing ·
__ USDC earned from __ lookups". (Record this LAST so the numbers are max.)

**VO:** "This is Actuary. For the last __ days it's been spending its own
money — real USDC payments on a schedule, every thirty minutes, with no
human in the loop. Why would software pay for things? Because the agent
economy has a trust problem."

*Criteria hit: Technical Depth & Autonomy (unfakeable history), AI-Native Ops.*

## 0:20–0:45 — The problem

**Screen:** Scroll agents.circle.com/services (600+ listings). Overlay one
stat card: "Real machine-to-machine micropayment demand: ~4% of x402 volume."

**VO:** "Six hundred–plus services now sell to AI agents over x402 —
priced in USDC, no signups, no API keys. But nothing tells an agent which
services actually deliver. Directories index listings; nobody measures
delivery. So buyer agents waste money on dead endpoints, and skeptics call
machine commerce a demo."

*Criteria hit: Creativeness & Innovation (verified-absent gap).*

## 0:45–1:20 — What Actuary is (the differentiator, verbatim)

**Screen:** Split. Left: terminal running a probe round — 402 challenges,
latencies ticking. Right: leaderboard grades. Then one Gemini grading log
line with its rationale.

**VO:** "Actuary is Moody's plus Pingdom for machine commerce. A probe
fleet buys from marketplace services under hard wallet policies, measures
uptime, latency, and response validity — and Gemini grades every paid
response in production: did the service deliver what it advertises? We
don't scrape claims. **We pay. Directories index.** Every score is backed
by a receipt."

*Criteria hit: Gemini requirement on camera; AI-Native Operations ("AI
executes key decisions" = grading feeds 25% of the composite).*

## 1:20–1:50 — The money shot: the business loop, live

**Screen:** Terminal, single take, no cuts: a buyer agent about to spend
$0.30 on a service runs
`circle services pay "https://actuary-…/v1/score?url=<target>" --max-amount 0.002`
→ x402 402 challenge → settled → scorecard shows the target is grade D
(failing) → agent picks the grade-A competitor instead. Then click the
settlement/explorer link.

**VO:** "And Actuary sells what it learns, the same way it buys. Before an
agent spends thirty cents on a service, it spends a tenth of a cent asking
whether that service worked this week. No account, no API key — the payment
IS the authentication. That lookup just settled in USDC through Circle
Gateway, served from Google Cloud Run. Money saved, on camera."

*Criteria hit: the REQUIRED real USDC transaction; Centrality to Business
(revenue and cost are both nanopayments); Customer Experience.*

## 1:50–2:20 — Autonomy within set rules + on-chain proof

**Screen:** Wallet policy view (daily cap, per-service caps) →
`circle transaction list` scrolling → click the leaderboard's wallet link →
block explorer: the agent's address, settlements visible.

**VO:** "Every purchase runs inside rules the wallet itself enforces —
daily budget, per-service caps, MPC-signed, sanctions-screened. This is
the agent's wallet, on-chain, public: every probe it bought, every lookup
it sold. The daily cap has never been exceeded — not because our code is
polite, but because Circle's policy engine physically refuses the
signature."

*Criteria hit: "genuinely agent-driven, within set rules" — Circle's
verbatim standard; proof items (wallet address + explorer URL) on camera.*

## 2:20–2:50 — Traction + close

**Screen:** Earnings ledger (payer addresses, tx refs). If pilot teams
landed: their lookup traffic. End card: leaderboard URL ·
github.com/mattspaulding/actuary · wallet address + explorer link ·
"Built on Circle Agent Stack · Gemini · Google Cloud Run".

**VO:** "Agents pay Actuary every day — [if pilots: 'including buyer agents
from other teams in this competition'] — and every cent, in and out, is
verifiable by anyone. The agent economy is real. It just needed someone to
measure it. Actuary — the agent economy, measured."

---

## Production notes

- **Record the numbers last:** the cold-open counters and the leaderboard
  should be captured the day before submission so probe counts are maximal.
- **The 1:20 money shot must be one unbroken take** (402 → settle →
  scorecard → explorer). Practice it; it's the eligibility clip.
- **Grade-D target for the demo:** pick a genuinely failing service from
  the index that day; do not stage one. If none is failing, reframe: "the
  cheapest A-grade provider" comparison still shows money saved.
- **Mainnet contingency:** if mainnet Base probes are live by recording
  day, use a Basescan link in the 1:50 section (more impressive than the
  Arc testnet explorer) and say "live on Base mainnet." If testnet-only,
  say "settling on Circle's Arc testnet today, mainnet at Arc GA" —
  Circle's rules explicitly allow testnet with a production roadmap.
- **What NOT to include:** no architecture slides, no code scrolling, no
  founder webcam intro — every second either shows money moving or proof
  it moved. The narrative doc carries the rest.
