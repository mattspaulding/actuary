# Actuary — the agent economy, measured

## What it is

Actuary is the reputation layer for the machine economy: an autonomous
watchdog that continuously buys from the 600+ x402 services on Circle's Agent
Marketplace with real, policy-capped USDC, measures what actually comes back
— uptime, latency, protocol conformance — has Gemini grade every paid
response in production, and sells the resulting trust scores back to other
agents at $0.001 per lookup. Moody's plus Pingdom, for machine commerce.

We pay. Directories index.

## The problem

Agentic payments crossed a threshold this year: agents hold wallets, x402
settles machine-to-machine purchases in USDC, and Circle's marketplace lists
hundreds of paid services with no signups and no API keys. What nobody built
is the trust primitive underneath. A buyer agent choosing between services
has listings and prices — but no way to know which endpoints actually
deliver this week. Directories index claims; nobody measures delivery. The
skeptic's critique of machine commerce ("it's all demos") survives because
the evidence layer is missing.

## How it works

A probe fleet enumerates the marketplace through Circle's public Discovery
API and probes every service on a schedule — free x402 liveness checks
(reading the 402 challenge itself) plus paid purchases executed via the
Circle CLI from a Circle Agent Wallet. Spending runs inside two layers of
rules: per-call and daily budget caps enforced in code, and the Agent
Wallet's own MPC-enforced spending policy behind them. Payments the fleet
makes and payments it receives both settle as Circle Gateway nanopayments
(x402 v2, EIP-3009 signed authorizations, batched on-chain settlement).

Gemini is the production brain: every paid response is graded 0–10 against
what the service advertises — substance, coherence, usability — and that
grade feeds 25% of the composite score. Scoring is honest by construction:
probe-side failures (our expired session, our empty balance) are excluded so
a seller is never penalized for the watchdog's bad day, and unknown services
answer 404 free — a buyer never pays to learn "we don't know."

The sell side is one paid endpoint: before an agent spends $0.30 on a
service, it spends $0.001 asking Actuary whether that service has been
delivering. No account, no key — the payment is the authentication. A
drop-in agent skill (`check-before-you-pay`) makes the habit one install
away for any agent framework.

## What's real today

Everything in the demo runs live: the score API on Google Cloud Run, the
probe fleet on a 30-minute schedule, real USDC settlements through Circle
Gateway's facilitator, and every observation appended to an auditable log.
The agent's wallet, its Gateway deposits, and its settlements are on-chain
and publicly verifiable (address in the submission; transaction receipts
independently checkable via Arc's RPC). Producing the demo video surfaced a
broken explorer link on our leaderboard — the evidence pipeline caught it,
which is the product thesis in miniature.

We are candid about stage: this is day-old infrastructure whose first
paying customer is itself. Marketplace probes run on Arc Testnet today
(zero marketplace services currently accept testnet payment for full paid
probes — itself a finding our estimate-mode probes document), with the
production roadmap running the same loop against Base mainnet, where the
fleet's purchases become Basescan-visible receipts. Revenue is measured in
tenths of cents, not dollars; what the 90-day window proves is the loop,
not the volume: agents autonomously buying observation, agents autonomously
paying for trust data, every cent with a receipt.

## Business model and category

Actuary sells trust, priced for machines: $0.001 scorecard lookups at
effectively zero marginal cost, a planned seller-side "verified reliable"
badge (paid by the seller's own agent), and the probe fleet as a
subscription-grade monitoring service for marketplace sellers. The customers
of the agent economy are overwhelmingly small teams — solo builders selling
API services, small businesses whose agents buy them — which is why we
submit under Small Business Services: Actuary protects small buyers' spend
and gives small sellers a public reliability record that big incumbents get
from brand alone.

## Why this is AI-native

There is no version of this business without AI in the loop. Gemini grades
every paid response in production and its judgment moves the score that
moves buyers' money. The probe fleet decides, pays, records, and re-prices
autonomously around the clock — the "days unattended" counter on our
leaderboard is the operations dashboard. The humans set policy; the agents
run the business.

## Built on

Circle Agent Stack (Agent Wallets, Gateway Nanopayments, Agent Marketplace,
Circle CLI, Circle Skills) · Gemini via AI Studio · Google Cloud Run ·
x402 v2. Open source: github.com/mattspaulding/actuary.
