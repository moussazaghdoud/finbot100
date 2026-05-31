# FinBot 100 — Tracer Bullet

The smallest end-to-end proof of FinBot 100's spine:

> **real data → AI council debate → falsifiable predictions → auto-grading → calibration scoreboard**

One asset (**BTC**), two agents (**ORACLE** momentum + **ATLAS** risk) plus a neutral **Moderator**. No 3D, no accounts, no database — a JSON file is the ledger. The point is to validate that the loop produces *honest, gradeable, interesting* output before building anything bigger.

## Requirements
- **Node 18+** (you have v24). That's it.
- Internet (to fetch real BTC prices from Binance/CoinGecko).
- **No API key needed** to try it: agents run in a transparent, data-driven **MOCK** mode. Add an Anthropic key to upgrade them to real Claude reasoning.

## Run it

```bash
cd tracer
npm run demo
```

`demo` runs the whole loop: seed real historical calls → grade them → show the scoreboard → run a fresh live debate.

Or step by step:

```bash
npm run debate   # run today's council debate on BTC, log 2 calls
npm run seed     # backfill real, already-resolvable historical calls (for an instant scoreboard)
npm run grade    # resolve any due calls against real BTC price
npm run board    # the Accountability Ledger: hit-rate, calibration gap, Brier score
```

## Upgrade to real Claude (optional)

```bash
npm install                       # installs @anthropic-ai/sdk
# set your key (PowerShell):
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run debate                    # agents now reason with Claude
```

Without the key/SDK, the agents reason from real price data (momentum, volatility, distance from highs) — clearly labelled `MOCK`. With the key, the same evidence is handed to Claude under each agent's persona and output contract.

## What to look for (the go/no-go test)
1. **Groundedness** — do agents cite real evidence, never invent numbers?
2. **Genuine disagreement** — do ORACLE and ATLAS diverge usefully?
3. **Grading works** — do calls resolve correctly against real price?
4. **Calibration is meaningful** — is the gap between stated confidence and realized hit-rate honest?
5. **Is the brief interesting** — would you read it daily?
6. **Unit economics** — cost per debate sane under shared compute?

4-of-6 yes → build the MVP (add SAGE, equities, one 3D view, the You-vs-Council game, auth).

## Files
- `src/data/` — real market data + news (references only)
- `src/agents/` — ORACLE, ATLAS, Moderator, Claude wrapper, shared output contract
- `src/ledger/` — the store, auto-grading, calibration math
- `src/commands/` — debate / seed / grade / board / demo
