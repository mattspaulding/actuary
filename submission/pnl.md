# Profit & loss — May 19 to submission (honest, small numbers)

Actuary was conceived July 30, 2026 and built July 30–31 inside the
submission window. We report fiat and stablecoin flows separately and make
no attempt to dress them up: the 90-day window demonstrates a working,
settling revenue loop, not volume.

## Fiat (USD)

| Month | Revenue | Expenses | Notes |
|---|---|---|---|
| May 2026 | $0.00 | $0.00 | pre-inception |
| June 2026 | $0.00 | $0.00 | pre-inception |
| July 2026 | $0.00 | < $1.00 | Google Cloud Run + Cloud Build (within/near free tier); Gemini API free tier; $0 marketing spend |

No fiat revenue to date. No customer acquisition spend.

## Stablecoin (USDC) — machine-to-machine flows

| Flow | Amount | Rail |
|---|---|---|
| Score lookups sold (revenue) | 0.004 USDC (4 lookups) | x402 / Circle Gateway, Arc Testnet |
| Probe purchases (COGS) | testnet USDC, policy-capped at 2.00/day | Circle Agent Wallet |
| Treasury | 20 USDC faucet + 5 USDC Gateway deposit | Arc Testnet |

Testnet USDC has no fiat value; we list it because the *settlement
mechanics* — signed EIP-3009 authorizations, facilitator verification,
batched on-chain settlement, per-sale receipts — are identical to mainnet,
where this loop deploys at Arc GA / with mainnet probe funding.

## Unit economics (the model, demonstrated)

- Price per scorecard lookup: $0.001; marginal cost ≈ $0 (cached index read)
- Probe cost per service per day: $0.001–$0.10 depending on service price,
  amortized across every lookup sold
- Related-party disclosure: the 4 lookups sold to date were purchased by
  our own probe wallet during development and demo recording — disclosed
  here per the related-party revenue requirement. External adoption path:
  the open-source `check-before-you-pay` skill.
