# Deploying FinBot 100 to Railway

The app is in the **`app/`** subfolder of the repo. Two things matter most on
Railway: set the **Root Directory to `app`**, and add the **`ANTHROPIC_API_KEY`**
variable. Everything else is already wired (PORT is read automatically, the
server binds `0.0.0.0`, and `/api/config` is the health check).

## Option A — Deploy from GitHub (recommended)

1. Put this repo on GitHub (see "Git setup" below).
2. Railway → **New Project → Deploy from GitHub repo** → pick the repo.
3. Open the service → **Settings**:
   - **Root Directory:** `app`
   - (Build/Start are auto-detected via `package.json` + `railway.json`.)
4. **Variables** tab → add:
   - `ANTHROPIC_API_KEY = sk-ant-…`  ← this turns the six analysts from MOCK into real Claude
   - *(optional)* `ANTHROPIC_MODEL = claude-sonnet-4-6`
5. **Settings → Networking → Generate Domain** to get a public URL.
6. Done. The header badge will show `engine: Claude (…)` once the key is set.

## Option B — Deploy with the Railway CLI

```bash
npm i -g @railway/cli
railway login
cd app
railway init           # create a new project
railway up             # build & deploy this folder
railway variables --set ANTHROPIC_API_KEY=sk-ant-…
railway domain         # get a public URL
```

## Git setup (if not done yet)

```bash
cd <repo root: FinBot100>
git init
git add .
git commit -m "FinBot 100: strategy, tracer-bullet, and full demo app"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

The root `.gitignore` already excludes `node_modules/`, `.env`, runtime data,
and screenshots.

## Persistence note (important)

Railway's container filesystem is **ephemeral** — the JSON ledger in `app/data/`
resets on every redeploy (the app simply reseeds real historical calls on boot,
so the scoreboard is never empty, but a *user's* accumulated calls won't survive
a redeploy). To make it durable:

1. Railway → service → **Volumes → New Volume**, mount path e.g. `/data`.
2. Add variable `DATA_DIR = /data`.

The app writes its ledger there instead. (The real production design replaces
JSON with Postgres — see `../FINBOT100_STRATEGY.md`.)

## Security reminder
- Never commit the API key. Set it only in Railway's **Variables** (and your
  local `.env`, which is git-ignored).
- The app makes outbound calls to the Anthropic API and to keyless market-data
  providers (Binance/CoinGecko/Yahoo Finance) — all outbound, no inbound secrets.
