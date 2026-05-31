# FinBot 100 — Financial Intelligence Platform (demo)

An educational financial-intelligence platform built on the redesigned concept
(see `../FINBOT100_STRATEGY.md`). Three integrated experiences:

1. **The Living Universe** — a real-time animated market map. Assets are stars
   (green = up / red = down over 7d), links are real correlations, size & glow =
   recent activity, with the macro risk-on/off regime shown live.
2. **The Analyst Council** — six AI analysts (Sage, Oracle, Scout, Sentinel,
   Atlas, Alchemist) debate any asset and issue *falsifiable theses* (never
   buy/sell advice). A neutral Moderator surfaces the agreement/disagreement,
   the strongest bull and bear case, and the open question.
3. **The Accountability Ledger** — every call is auto-graded against real price
   at its horizon. Each analyst carries a public **hit rate, calibration gap and
   Brier score**. Plus **You vs the Council**: record your own call first and
   build your own track record.

## Requirements
- **Node 18+** (you have v24). Nothing else.
- Internet (real prices: crypto via Binance/CoinGecko, stocks/ETFs via Yahoo Finance — all keyless).
- **No API key needed.** The analysts reason from real market data in a
  transparent **MOCK** mode. Add an Anthropic key to upgrade them to real Claude.

## Run

```bash
cd app
npm start
```

Then open **http://127.0.0.1:7100**. (Set `PORT` to change it.)

On first launch it seeds the Ledger with real, already-resolvable historical
calls so the scoreboard is meaningful immediately, then auto-grades them.

## Upgrade to real Claude (optional)

```bash
npm install                         # installs @anthropic-ai/sdk
$env:ANTHROPIC_API_KEY = "sk-ant-…" # PowerShell
npm start
```

The same evidence is then handed to Claude under each analyst's persona and
output contract. The badge in the header shows which engine is live.

## How it's built
- **Backend:** zero-dependency Node HTTP server (`server.js`) + JSON API.
- **Engine:** `src/agents` (council + moderator), `src/core` (debate orchestration,
  shared macro/geo context, universe/correlation map, history seeder),
  `src/data` (market + news), `src/ledger` (store, auto-grade, calibration).
- **Frontend:** vanilla JS + canvas (`public/`). No build step.
- **Persistence:** JSON files in `data/` (the production design uses Postgres —
  see the strategy doc).

## API
`GET /api/config` · `GET /api/universe` · `GET /api/debate?asset=BTC` ·
`GET /api/ledger` · `GET /api/me` · `POST /api/predict` · `POST /api/grade`

## Important
Educational simulation. The analysts present falsifiable hypotheses, **not**
investment advice; nothing here is a recommendation to buy or sell, and no real
money is involved. This boundary is a deliberate product + compliance choice
(see `../FINBOT100_DEEPDIVE.md`, section A).
