// FinBot 100 — zero-dependency HTTP server: static frontend + JSON API.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { CONFIG } from './src/config.js';
import { AGENTS, COUNCIL_ORDER } from './src/agents/registry.js';
import { llmMode } from './src/agents/llm.js';
import { runDebate } from './src/core/debate.js';
import { getUniverse } from './src/core/universe.js';
import { seedHistoryIfEmpty } from './src/core/seed.js';
import { getSignals, trackRecord, recentAlerts } from './src/core/signals.js';
import { getSpot } from './src/data/market.js';
import { tick } from './src/fund/trader.js';
import { loadFund, saveFund, valuation, freshFund } from './src/fund/portfolio.js';
import { gradeDue } from './src/ledger/grade.js';
import { scoreboard } from './src/ledger/calibration.js';
import {
  loadPredictions,
  makePrediction,
  appendPredictions,
  loadUser,
  saveUser,
} from './src/ledger/store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, code, data, type = 'application/json') {
  const body = type === 'application/json' ? JSON.stringify(data) : data;
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(b || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

async function fundView() {
  const fund = loadFund();
  const prices = {};
  for (const a of Object.keys(fund.positions)) {
    if (!fund.positions[a]?.qty) continue;
    const p = await getSpot(a);
    if (p) prices[a] = p;
  }
  const v = valuation(fund, prices);
  return {
    base: fund.base,
    autoOn: fund.autoOn,
    autoMin: CONFIG.fund.autoMin,
    startedAt: fund.startedAt,
    lastTickAt: fund.lastTickAt,
    ...v,
    equity: fund.equity.slice(-200),
    trades: fund.trades.slice(-40).reverse(),
    tradeCount: fund.trades.length,
  };
}

async function serveStatic(req, res) {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const full = normalize(join(PUBLIC, p));
  if (!full.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  try {
    const data = await readFile(full);
    send(res, 200, data, MIME[extname(full)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'not found', 'text/plain');
  }
}

async function api(req, res, url) {
  const path = url.pathname;
  try {
    if (path === '/api/config') {
      return send(res, 200, {
        llmMode: llmMode(),
        horizonDays: CONFIG.horizonDays,
        neutralBand: CONFIG.neutralBand,
        signalsEveryMin: CONFIG.signals.everyMin,
        startingCapital: CONFIG.startingCapital,
        universe: CONFIG.universe,
        agents: AGENTS,
        councilOrder: COUNCIL_ORDER,
      });
    }
    if (path === '/api/signals') {
      const signals = await getSignals();
      await gradeDue();
      return send(res, 200, { signals, track: trackRecord(), alerts: recentAlerts(), horizonDays: CONFIG.horizonDays, ts: Date.now() });
    }
    if (path === '/api/alerts') return send(res, 200, { alerts: recentAlerts() });
    if (path === '/api/universe') return send(res, 200, await getUniverse());
    if (path === '/api/debate') {
      const asset = url.searchParams.get('asset') || 'BTC';
      return send(res, 200, await runDebate(asset));
    }
    if (path === '/api/ledger') {
      await gradeDue();
      const preds = loadPredictions();
      const recent = preds
        .filter((p) => p.resolved && !p.void)
        .sort((a, b) => b.resolveAt - a.resolveAt)
        .slice(0, 12);
      return send(res, 200, {
        board: scoreboard(preds),
        pending: preds.filter((p) => !p.resolved).length,
        resolved: preds.filter((p) => p.resolved && !p.void).length,
        recent,
      });
    }
    if (path === '/api/me') {
      await gradeDue();
      const preds = loadPredictions();
      const mine = preds.filter((p) => p.agent === 'YOU');
      const board = scoreboard(preds).filter((b) => b.agent === 'YOU')[0] || null;
      const user = loadUser();
      return send(res, 200, {
        you: board,
        capital: user.capital,
        conviction: user.conviction,
        pending: mine.filter((p) => !p.resolved).length,
        history: mine.sort((a, b) => b.createdAt - a.createdAt).slice(0, 10),
      });
    }
    if (path === '/api/predict' && req.method === 'POST') {
      const { asset, stance, confidence } = await readBody(req);
      if (!asset || !['bullish', 'bearish', 'neutral'].includes(stance))
        return send(res, 400, { error: 'asset and valid stance required' });
      const brief = await runDebate(asset); // ensures price + agent calls exist
      const conf = Math.max(50, Math.min(90, Number(confidence) || 60));
      const pred = makePrediction(
        { agent: 'YOU', stance, confidence: conf, thesis: 'Your call', horizonDays: CONFIG.horizonDays },
        asset,
        brief.price,
        'user'
      );
      appendPredictions([pred]);
      // allocate a slice of conviction capital toward your active call
      const user = loadUser();
      user.conviction[asset] = (user.conviction[asset] || 0) + 10;
      saveUser(user);
      return send(res, 200, { ok: true, prediction: pred, council: brief.theses, moderator: brief.moderator });
    }
    if (path === '/api/grade' && req.method === 'POST') {
      const n = await gradeDue();
      return send(res, 200, { graded: n });
    }
    if (path === '/api/fund') return send(res, 200, await fundView());
    if (path === '/api/fund/tick' && req.method === 'POST') {
      const r = await tick();
      return send(res, 200, { ...r, view: await fundView() });
    }
    if (path === '/api/fund/auto' && req.method === 'POST') {
      const { on } = await readBody(req);
      const fund = loadFund();
      fund.autoOn = Boolean(on);
      saveFund(fund);
      return send(res, 200, { autoOn: fund.autoOn });
    }
    if (path === '/api/fund/reset' && req.method === 'POST') {
      const f = freshFund();
      saveFund(f);
      return send(res, 200, { ok: true, view: await fundView() });
    }
    return send(res, 404, { error: 'unknown endpoint' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  return serveStatic(req, res);
});

async function warmup() {
  // Backfill + grade the ledger in the background so the health check (and the
  // UI) come up immediately even on a cold Railway deploy.
  try {
    const n = await seedHistoryIfEmpty();
    if (n) console.log(`  Seeded ${n} historical agent calls.`);
    const g = await gradeDue();
    if (g) console.log(`  Graded ${g} due predictions.`);
  } catch (e) {
    console.warn(`  (background seed/grade skipped: ${e.message})`);
  }
}

function start() {
  console.log('FinBot 100 — starting…');
  console.log(`  Reasoning engine: ${llmMode()}`);
  server.on('error', (e) => {
    console.error(`  Server error: ${e.code === 'EADDRINUSE' ? `port ${CONFIG.port} is already in use — set PORT to a free port` : e.message}`);
    process.exit(1);
  });
  server.listen(CONFIG.port, CONFIG.host, () => {
    const shown = CONFIG.host === '0.0.0.0' ? '127.0.0.1' : CONFIG.host;
    console.log(`\n  ▶  FinBot 100 running at http://${shown}:${CONFIG.port}\n`);
    warmup();
    startAutoTrader();
    startSignalWatch();
  });
}

function startAutoTrader() {
  const ms = Math.max(2, CONFIG.fund.autoMin) * 60000;
  console.log(`  Auto-trader: every ${CONFIG.fund.autoMin} min (toggle in the Fund tab).`);
  const runCycle = async () => {
    const fund = loadFund();
    if (!fund.autoOn) return;
    try {
      const r = await tick();
      if (r.trades?.length) console.log(`  Auto-trade: ${r.trades.map((t) => `${t.side} ${t.asset}`).join(', ')}`);
    } catch (e) {
      console.warn(`  Auto-trade cycle error: ${e.message}`);
    }
  };
  // First cycle ~8s after boot so the fund deploys and trades are visible early.
  setTimeout(runCycle, 8000);
  setInterval(runCycle, ms);
}

function startSignalWatch() {
  const ms = Math.max(5, CONFIG.signals.everyMin) * 60000;
  console.log(`  Signal watch: every ${CONFIG.signals.everyMin} min${CONFIG.signals.ntfyTopic ? ' (+ ntfy push)' : ''}.`);
  const run = () => getSignals().catch((e) => console.warn(`  Signal watch error: ${e.message}`));
  setTimeout(run, 20000);
  setInterval(run, ms);
}

start();
