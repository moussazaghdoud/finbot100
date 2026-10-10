// Signals: one BUY / SELL / HOLD call per asset, derived from the Council debate.
// Also: the signals' own track record, and alerts when a signal flips.
import { CONFIG } from '../config.js';
import { runDebate } from './debate.js';
import { loadPredictions, readJson, writeJson } from '../ledger/store.js';
import { logEvent } from '../bot/activity.js';

const S = CONFIG.signals;

// Council signal in -1..+1 (confidence-weighted net stance).
export function signalFromBrief(brief) {
  if (!brief?.theses?.length) return 0;
  let s = 0;
  for (const t of brief.theses) s += t.stance === 'bullish' ? t.confidence : t.stance === 'bearish' ? -t.confidence : 0;
  return +(s / (brief.theses.length * 90)).toFixed(3);
}

export function actionFor(score) {
  if (score >= S.buyThreshold) return 'BUY';
  if (score <= -S.sellThreshold) return 'SELL';
  return 'HOLD';
}

function toSignal(brief) {
  const score = signalFromBrief(brief);
  const action = actionFor(score);
  const { b, r } = brief.moderator.tally;
  const m = brief.moderator;
  return {
    asset: brief.asset,
    name: brief.name,
    sector: brief.sector,
    price: brief.price,
    ret7d: brief.evidence.ret7d,
    ret30d: brief.evidence.ret30d,
    action,
    score,
    strength: Math.round(Math.abs(score) * 100),
    votes: { bull: b, bear: r, neutral: brief.theses.length - b - r },
    reason: action === 'SELL' ? m.bearCase : action === 'BUY' ? m.bullCase : m.summary,
    risk: action === 'SELL' ? m.bullCase : m.bearCase,
    theses: brief.theses.map((t) => ({ agent: t.agent, stance: t.stance, confidence: t.confidence, thesis: t.thesis })),
    ts: brief.ts,
  };
}

// Debates are cached per asset (CONFIG.debateCacheMin), so this is cheap after the first run.
export async function getSignals({ onProgress } = {}) {
  const ids = CONFIG.universe.map((a) => a.id);
  const out = [];
  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      onProgress?.(ids.length - queue.length, ids.length, id);
      try {
        out.push(toSignal(await runDebate(id)));
      } catch (e) {
        out.push({ asset: id, name: CONFIG.universe.find((a) => a.id === id).name, error: e.message });
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  await detectFlips(out.filter((s) => !s.error));
  const rank = { BUY: 0, SELL: 1, HOLD: 2 };
  return out.sort((x, y) => (rank[x.action] ?? 3) - (rank[y.action] ?? 3) || (y.strength || 0) - (x.strength || 0));
}

// ── Track record ──────────────────────────────────────
// Each asset-day's logged agent calls are re-combined into the signal they
// produced, then graded with the agents' own resolved returns.
function judge(action, ret) {
  if (action === 'BUY') return ret > 0;
  if (action === 'SELL') return ret < 0;
  return Math.abs(ret) <= CONFIG.neutralBand;
}

export function trackRecord() {
  const groups = new Map();
  for (const p of loadPredictions()) {
    if (p.source !== 'agent') continue;
    const k = p.asset + '|' + new Date(p.createdAt).toDateString();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }

  const graded = [];
  let pending = 0;
  for (const g of groups.values()) {
    if (g.length < 4) continue; // incomplete council
    if (!g.every((p) => p.resolved)) { pending++; continue; }
    if (g.some((p) => p.void)) continue; // no price on the resolve day
    const score = signalFromBrief({ theses: g });
    const action = actionFor(score);
    const ret = g[0].actualReturn;
    graded.push({ asset: g[0].asset, action, score, ret, correct: judge(action, ret), seeded: g.every((p) => p.seeded), createdAt: g[0].createdAt, priceAtCall: g[0].priceAtCall, priceAtResolve: g[0].priceAtResolve });
  }

  const byAction = {};
  for (const a of ['BUY', 'SELL', 'HOLD']) {
    const xs = graded.filter((x) => x.action === a);
    const hits = xs.filter((x) => x.correct).length;
    byAction[a] = {
      n: xs.length,
      hits,
      hitRate: xs.length ? +((hits / xs.length) * 100).toFixed(1) : null,
      avgReturn: xs.length ? +(xs.reduce((s, x) => s + x.ret, 0) / xs.length).toFixed(2) : null,
    };
  }

  const byAsset = {};
  for (const x of graded) {
    if (x.action === 'HOLD') continue;
    const a = (byAsset[x.asset] ||= { n: 0, hits: 0 });
    a.n++;
    a.hits += x.correct ? 1 : 0;
  }

  const recent = graded
    .filter((x) => x.action !== 'HOLD')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 15);

  const backtest = graded.filter((x) => x.seeded).length;
  return { byAction, byAsset, recent, pending, live: graded.length - backtest, backtest, horizonDays: CONFIG.horizonDays };
}

// ── Alerts (signal flips) ─────────────────────────────
const loadAlerts = () => readJson(CONFIG.alertsFile, { last: {}, events: [] });

export function recentAlerts(n = 20) {
  return loadAlerts().events.slice(-n).reverse();
}

async function detectFlips(signals) {
  const st = loadAlerts();
  const fresh = [];
  for (const s of signals) {
    const prev = st.last[s.asset];
    if (prev && prev !== s.action) {
      fresh.push({ id: `${s.asset}-${Date.now()}`, asset: s.asset, name: s.name, from: prev, to: s.action, price: s.price, strength: s.strength, t: Date.now() });
    }
    st.last[s.asset] = s.action;
  }
  st.events.push(...fresh);
  st.events = st.events.slice(-200);
  writeJson(CONFIG.alertsFile, st);
  for (const e of fresh) {
    logEvent('flip', `${e.asset} signal changed: ${e.from} → ${e.to}`, { asset: e.asset, from: e.from, to: e.to, price: e.price });
    await pushNtfy(e);
  }
  return fresh;
}

async function pushNtfy(e) {
  if (!S.ntfyTopic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(S.ntfyTopic)}`, {
      method: 'POST',
      headers: { Title: `FinBot: ${e.asset} ${e.from} -> ${e.to}`, Tags: e.to === 'BUY' ? 'green_circle' : e.to === 'SELL' ? 'red_circle' : 'yellow_circle' },
      body: `${e.name} is now ${e.to} (was ${e.from}) at $${e.price} · strength ${e.strength}`,
    });
  } catch (err) {
    console.warn(`  ntfy push failed: ${err.message}`);
  }
}
