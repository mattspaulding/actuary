# Production & payment evidence

Generated 2026-07-31 19:00 UTC from the live data ledgers.
Regenerate any time: `python3 submission/gen_evidence.py` (this file's numbers
grow continuously — the probe fleet runs every 30 minutes via scheduler).

## Agent wallet (proof item)

- Address: `0x91d81258fbfb005376b8589eca5f852a223be9ce` (Circle Agent Wallet, 2-of-2 MPC)
- Explorer: https://testnet.arcscan.app/address/0x91d81258fbfb005376b8589eca5f852a223be9ce
- Chain: Arc Testnet (`eip155:5042002`); Gateway balance funds x402 nanopayments

## On-chain transactions (independently verifiable)

| What | Tx hash |
|---|---|
| Gateway deposit approve | `0xa5b740a84213858f93c48d84a4b43614b94147373d728be66779b92223bdfdf7` |
| Gateway deposit (5 USDC) | `0x9dba7cae1a784bf5a5962272560d3a2a7e44c6d092164d658f20b1ab4a8845a3` |
| Wallet faucet funding | `0xa11516a8672e241ecf00bfaf20f0b363b86da6c849ca2c82ffb25c123f9988a4` |

Verify via RPC: `curl https://rpc.testnet.arc.network -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["<hash>"]}'`

## Probe fleet (agent logs / API records)

- Window: 2026-07-31T01:19:47.161Z → 2026-07-31T18:56:29.842Z
- Probes recorded: **235** across **40** marketplace services, 1 calendar days
- Service-up observations: 235 (100%)
- Raw log: `data/probes.jsonl` (one JSON observation per probe; mode, outcome, latency, payment refs)
- Scheduler: launchd `com.actuary.probe`, every 30 minutes, unattended

## Revenue events (agent-to-agent sales)

- Score lookups sold: **2** — 0.0020 USDC, each settled via Circle Gateway x402
- Ledger: `data/earnings.jsonl` (payer, network, settlement transaction per sale)
- Example settlement: `b8aa3e6e-5c1d-43ea-b086-f602ce5e10b5` from payer `0xffc105aaf7b2207aa742de7a4078a3314f2a7d91`

## Live surfaces

- Score API + leaderboard: https://actuary-695835808761.us-central1.run.app (Google Cloud Run, revision serving 100%)
- Gemini grading: production `generateContent` calls on every paid probe (model: gemini-flash-latest, project 280514469684)
