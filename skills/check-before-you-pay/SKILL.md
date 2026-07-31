---
name: check-before-you-pay
description: "Use this skill BEFORE paying for any x402 / Circle Agent Marketplace service, when choosing between candidate paid services, or when a paid call just failed or returned junk and the agent wonders if the service is flaky. Actuary is a trust index that continuously buys from marketplace services with real USDC and grades what comes back — one $0.001 lookup tells you whether a service has actually been delivering this week, before you spend 10-300x that on a dead or degraded endpoint. Triggers on: which service should I use, is this service reliable, service returned garbage, paid API failed, x402, marketplace reliability, trust score, check before paying, wasted spend, compare paid services."
allowed-tools: ["Bash(circle services pay *)", "Bash(circle wallet status*)", "Bash(circle wallet balance*)", "Bash(circle gateway balance*)", "Bash(curl -s *)"]
---

## Overview

Actuary (https://actuary-695835808761.us-central1.run.app) is the reputation
layer for the agent economy: an autonomous probe fleet that pays marketplace
services with real USDC on a schedule, measures uptime / latency / response
validity, grades response quality with an LLM, and publishes composite scores.
We pay. Directories index.

This skill is the buyer-side habit: **one cheap lookup before every
non-trivial paid call.** A $0.001 scorecard that says "this service has been
failing deliveries for two days" saves the $0.30 call AND the downstream task
built on its garbage output.

## Step 1 — Free teaser: grades for every scored service

No wallet needed:

```bash
curl -s "https://actuary-695835808761.us-central1.run.app/v1/scores"
```

Returns `{services: [{resource, provider, grade, samples, lastProbe}]}`.
Grades run A (≥85 composite) to F (<40). Use this to shortlist candidates or
spot an obviously dead option before Step 2.

## Step 2 — Paid detail: the full scorecard for one service

When you are about to spend real money on a specific service, buy its
scorecard ($0.001 USDC via x402 / Circle Gateway):

```bash
circle services pay "https://actuary-695835808761.us-central1.run.app/v1/score?url=<SERVICE_RESOURCE_URL>" \
  --address <YOUR_AGENT_WALLET> --chain <YOUR_CHAIN> --max-amount 0.002
```

`<SERVICE_RESOURCE_URL>` is the exact `resource` URL from the marketplace
listing (e.g. `https://agents.allium.so/api/v1/developer/prices`). Payment
settles on any Gateway-supported network; Actuary currently runs against the
testnet facilitator (mainnet at Arc GA).

The response:

```json
{
  "resource": "…", "grade": "A", "composite": 98,
  "uptime": 1, "latencyP50Ms": 1273, "schemaValidRate": null,
  "avgQuality": null, "samples": 63, "paidSamples": 0,
  "firstProbe": "…", "lastProbe": "…"
}
```

## Step 3 — Act on the scorecard

- **Grade A/B** → proceed with the paid call.
- **Grade C/D** → proceed only if no better-scored alternative serves the
  need; prefer a re-search of the marketplace first.
- **Grade F** → do not pay; pick another provider and tell the user why.
- **HTTP 404 from Actuary** → the service hasn't been probed yet (404s are
  free — you are never charged to learn "unknown"). Treat as unrated, not
  bad: proceed with a tight `--max-amount` and your own judgment.
- Weigh `samples` and `lastProbe` — a B from 60 samples probed an hour ago
  beats an A from 2 samples last week.

## Honesty notes

- Scores come from real, policy-capped USDC purchases and free x402
  liveness checks; scoring methodology and a seller correction path are
  published in the Actuary repo.
- `probe_error` observations (Actuary's own auth/balance failures) are
  excluded from scores — a seller is never penalized for the watchdog's bad
  day.
