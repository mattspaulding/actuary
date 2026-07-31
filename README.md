# Actuary — the paying watchdog

**The agent economy, measured.** Actuary is an autonomous probe fleet that
continuously *buys* from the services on [Circle's Agent
Marketplace](https://agents.circle.com/services) with real USDC nanopayments,
grades what comes back with Gemini, and sells the resulting trust scores back
to other agents at $0.001 per lookup — Moody's plus Pingdom for machine
commerce.

We pay. Directories index.

## Why this exists

Before a buyer agent spends $0.30 on a domain-search call, it can spend $0.001
asking Actuary whether that service has actually been delivering this week.
There is no reputation layer on the marketplace today; Actuary is the missing
primitive, and it funds its own observations.

## Architecture

```
┌─────────────────────────────  probe fleet (buyer)  ─────────────────────────┐
│ Discovery API ─→ filter by price cap ─→ probe each service                  │
│   estimate mode: free — measure the 402 challenge (liveness, conformance)   │
│   paid mode:     `circle services pay` under --max-amount + daily budget    │
│                  └─→ Gemini grades the paid response (0-10)                 │
│ every observation ─→ data/probes.jsonl                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                              scoring window (14d)
                    uptime · p50 latency · schema validity · quality
                                     │
┌─────────────────────────────  score API (seller)  ──────────────────────────┐
│ GET /            free leaderboard                                           │
│ GET /v1/scores   free teaser (grades only)                                  │
│ GET /v1/score    $0.001 USDC via x402 + Circle Gateway batching — the       │
│                  full scorecard for one service                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Two layers of spend safety, by design:

1. **In code (belt):** `MAX_PER_CALL_USDC` per call and `DAILY_BUDGET_USDC`
   per day, enforced before any paid probe fires.
2. **On the wallet (suspenders):** the Agent Wallet's own spending policy
   (`circle wallet limit set`) — enforced by Circle's MPC infrastructure even
   if this code misbehaves. This is the "within set rules" story.

## Quickstart

```bash
npm install
cp .env.example .env

# Works immediately, no wallet, no auth — free estimate probes:
npm run probe
npm run scores
npm run serve     # leaderboard on http://localhost:8080
```

### Operator steps (human consent required — the code never does these)

1. Read and accept the Circle CLI terms: `npx circle terms accept`
   (Terms: https://agents.circle.com/terms-of-use)
2. Log in (email OTP): `npx circle wallet login you@example.com --testnet`
3. Create the probe wallet: `npx circle wallet create --chain ARC-TESTNET`
4. Fund it from the testnet faucet: `npx circle wallet fund --address 0x… --chain ARC-TESTNET`
5. Set the on-wallet policy (mainnet): `npx circle wallet limit set …`
6. Put the wallet address in `.env` as `PROBE_WALLET_ADDRESS`, then:

```bash
npm run probe:paid
```

## Competition mapping (Circle Agentic Economy Prize)

- **Technical Depth & Autonomy** — the fleet makes real, policy-bounded USDC
  purchases on a schedule with no human in the loop; `data/probes.jsonl` and
  `circle transaction list` are the receipts.
- **Centrality to Business** — revenue in (score lookups) and cost out
  (probes) are both Gateway nanopayments; remove payments and no product
  remains.
- **Creativeness & Innovation** — a watchdog that funds its own observations;
  no reputation layer exists on the marketplace today.
- **Customer Experience** — one $0.001 call saves an agent from wasting 10-300x
  that on a dead service.
- **Gemini requirement** — every paid probe is graded by Gemini in production.

## Roadmap to production

- Cloud Run + Cloud Scheduler for continuous rounds (Dockerfile included)
- Mainnet Base probes for a Basescan-clickable proof trail
- `check-before-you-pay` Circle Skill so any agent can call Actuary in one line
- Seller-side "verified reliable" badge (paid, via the seller's own agent)
- Published scoring methodology + correction path for scored sellers
