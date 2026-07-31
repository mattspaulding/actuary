# DRAFT — Devpost discussion post (needs Matt's approval before posting)

**Title:** Free reliability scores for anyone building on Circle's Agent Stack (+ I'll probe your x402 endpoint)

**Body:**

Hey builders — I'm working on the Circle Agentic Economy Prize track and made
something that might be useful to other teams here, especially anyone whose
agents buy from (or sell on) the Circle Agent Marketplace.

**Actuary** is a watchdog agent that continuously buys from the 600+ x402
services on the marketplace with real (policy-capped) USDC, measures uptime,
latency, and response validity, grades response quality with Gemini, and
publishes trust scores. Live leaderboard:
https://actuary-695835808761.us-central1.run.app

Two offers, both free for XPRIZE teams:

1. **Buyer side** — if your agent pays for marketplace services, add one
   lookup before each paid call: `GET /v1/scores` is free, and the full
   scorecard for a specific service is $0.001 via x402 (a 404 for an
   unindexed service is always free). There's a drop-in agent skill
   (`check-before-you-pay`) in the repo.
2. **Seller side** — if your project EXPOSES an x402 endpoint, reply with the
   URL and I'll add it to the probe rotation so you get continuous uptime
   monitoring and a public reliability grade for free. Judges love
   third-party evidence that your service actually works.

Everything is open source (repo link on request until I flip it public), the
probe wallet and every settlement are on-chain and verifiable, and the
scoring methodology + seller correction path are published in the repo.

Happy to answer questions about the Agent Stack integration itself too —
wallet policies, Gateway nanopayments, the x402 batching middleware — we hit
most of the sharp edges already.
