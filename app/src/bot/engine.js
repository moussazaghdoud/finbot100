// The bot's heartbeat. Every CONFIG.signals.everyMin minutes it runs one cycle:
// analyse every asset → decide → trade the virtual fund → score itself — and
// writes each step to the activity log so you can watch it think.
import { CONFIG } from '../config.js';
import { llmMode, llmUsage } from '../agents/llm.js';
import { getSignals } from '../core/signals.js';
import { gradeDue } from '../ledger/grade.js';
import { getSpot, getEurUsd, usMarketOpen } from '../data/market.js';
import { loadFund, saveFund, snapshot, valuation, benchmarks, startChallenge } from '../fund/portfolio.js';
import { decide } from '../fund/trader.js';
import { runPortfolioManager } from '../agents/pm.js';
import { logEvent, getEvents } from './activity.js';

const EVERY_MS = Math.max(5, CONFIG.signals.everyMin) * 60000;
const bootAt = Date.now();
const state = { phase: 'idle', progress: null, lastRunAt: null, nextRunAt: null, lastError: null, lastPaidCycleUsd: null };

const eur = (n) => '€' + n.toFixed(2);
const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

// One line per cycle saying which data the analysis actually had.
function dataHealthText(signals) {
  const ok = signals.filter((s) => s.health);
  const n = ok.length;
  const count = (f) => ok.filter(f).length;
  const m = ok[0]?.health.macro || {};
  const macroOk = Object.values(m).filter((v) => v === 'ok').length;
  const fundStatus = [...new Set(ok.map((s) => s.health.fundamentals).filter((v) => v !== 'n/a'))].join(', ') || 'n/a';
  const missing = Object.entries(m).filter(([, v]) => v !== 'ok').map(([k, v]) => `${k}: ${v}`);
  return `Data this cycle: news ${count((s) => s.health.news === 'ok')}/${n} assets · related assets ${count((s) => { const [a, b] = String(s.health.peers).split('/'); return a === b; })}/${n} complete · macro ${macroOk}/${Object.keys(m).length} sources${missing.length ? ` (${missing.join('; ')})` : ''} · fundamentals: ${fundStatus} · ${count((s) => s.via === 'claude')}/${n} decided by Claude.`;
}

export function status() {
  const now = Date.now();
  let health = 'live';
  if (state.phase === 'thinking') health = 'thinking';
  else if (state.nextRunAt && now > state.nextRunAt + 5 * 60000) health = 'late';
  return {
    health,
    phase: state.phase,
    progress: state.progress,
    lastRunAt: state.lastRunAt,
    nextRunAt: state.nextRunAt,
    everyMin: CONFIG.signals.everyMin,
    engine: llmMode(),
    claude: { ...llmUsage(), perDayUsd: state.lastPaidCycleUsd == null ? null : +(state.lastPaidCycleUsd * (1440 / CONFIG.signals.everyMin)).toFixed(2) },
    uptimeSec: Math.round((now - bootAt) / 1000),
    lastError: state.lastError,
    now,
  };
}

export async function livePrices(assets) {
  const prices = {};
  await Promise.all(assets.map(async (a) => { const p = await getSpot(a); if (p) prices[a] = p; }));
  return prices;
}

async function finalize(fund) {
  const fx = await getEurUsd();
  const prices = await livePrices([...new Set([...Object.keys(fund.positions), ...Object.keys(fund.start?.prices || {})])]);
  const v = snapshot(fund, prices, fx);
  const bm = benchmarks(fund, prices, fx);
  fund.status = 'ended';
  fund.final = { t: Date.now(), value: v.total, pnl: v.pnl, pnlPct: v.pnlPct, benchmarks: bm, holdings: v.holdings };
  saveFund(fund);
  const best = [...bm].sort((a, b) => b.value - a.value)[0];
  logEvent('result', `Challenge over: ${eur(fund.base)} → ${eur(v.total)} (${pct(v.pnlPct)}).` + (best ? ` Best benchmark: ${best.label} ${eur(best.value)} (${pct(best.pnlPct)}).` : ''), { value: v.total, pnlPct: v.pnlPct, benchmarks: bm });
}

export async function beginChallenge() {
  const fund = startChallenge();
  const fx = await getEurUsd();
  const prices = await livePrices(CONFIG.universe.map((a) => a.id));
  fund.start = { prices, fx };
  snapshot(fund, prices, fx);
  saveFund(fund);
  logEvent('challenge', `Challenge started: ${eur(fund.base)} virtual, ${CONFIG.fund.durationDays} days, ends ${new Date(fund.endsAt).toUTCString()}. EUR/USD ${fx}.`);
  runCycle({ reason: 'challenge start' });
  return fund;
}

export async function runCycle({ reason = 'scheduled' } = {}) {
  if (state.phase === 'thinking') return { skipped: 'a cycle is already running' };
  state.phase = 'thinking';
  state.progress = { i: 0, n: CONFIG.universe.length, asset: null, step: 'analysing' };
  const cycle = Date.now().toString(36);
  const usdBefore = llmUsage().totalUsd;
  try {
    // Gap detection: was the bot offline since its last cycle?
    const lastCycle = getEvents({ limit: 3000 }).filter((e) => e.type === 'cycle').pop();
    if (lastCycle && Date.now() - lastCycle.t > 2 * EVERY_MS + 10 * 60000) {
      const h = (Date.now() - lastCycle.t) / 3600000;
      logEvent('offline', `Bot was offline for ${h >= 48 ? (h / 24).toFixed(1) + ' days' : h.toFixed(1) + ' h'} — no analysis or trading happened in that time.`, { since: lastCycle.t });
    }
    logEvent('cycle', `Cycle started (${reason}) — analysing ${CONFIG.universe.length} assets with ${llmMode()}.`, { cycle });

    const signals = await getSignals({ onProgress: (i, n, asset) => (state.progress = { i, n, asset, step: 'analysing' }) });
    for (const s of signals) {
      if (s.error) { logEvent('error', `${s.asset}: could not analyse — ${s.error}`, { cycle, asset: s.asset }); continue; }
      const ai = s.theses.filter((t) => t.via === 'claude').length;
      logEvent('analysis', `${s.asset}: ${s.votes.bull}↑ ${s.votes.bear}↓ → ${s.action} (strength ${s.strength}) · ${ai ? `${ai}/${s.theses.length} by Claude` : 'rules only'}`, {
        cycle, asset: s.asset, action: s.action, score: s.score, strength: s.strength, price: s.price, votes: s.votes, reason: s.reason, risk: s.risk, theses: s.theses, decision: s.decision, via: s.via,
      });
    }
    logEvent('data', dataHealthText(signals), { cycle });
    const u = llmUsage();
    if (u.enabled && u.failed && !u.ok) logEvent('error', `Claude is NOT being used: every call failed (${u.lastError}). The analysts used their built-in rules this cycle.`, { cycle });
    const counts = ['BUY', 'SELL', 'HOLD'].map((a) => `${signals.filter((s) => s.action === a).length} ${a}`).join(' · ');

    state.progress = { i: signals.length, n: signals.length, asset: null, step: 'deciding' };
    const fund = loadFund();
    if (fund.status === 'running' && Date.now() >= fund.endsAt) {
      await finalize(fund);
    } else if (fund.status === 'running' && (fund.autoOn || reason === 'manual')) {
      const fx = await getEurUsd();
      if (!fx) throw new Error('no EUR/USD rate — skipped trading this cycle');
      const prices = await livePrices([...new Set([...signals.map((s) => s.asset), ...Object.keys(fund.positions)])]);
      const marketOpen = usMarketOpen();
      // Portfolio manager: may veto trades for portfolio reasons (Claude only).
      let finalSignals = signals;
      if (signals.some((s) => s.via === 'claude')) {
        state.progress = { i: signals.length, n: signals.length, asset: null, step: 'portfolio review' };
        const pm = await runPortfolioManager({ fund: valuation(fund, prices, fx), signals: signals.filter((s) => !s.error) });
        if (pm) {
          const veto = Object.fromEntries(pm.vetoes.map((v) => [v.asset, v.reason]));
          finalSignals = signals.map((s) => (veto[s.asset] ? { ...s, action: 'HOLD', vetoed: veto[s.asset], vetoedAction: s.action } : s));
          logEvent('pm', `Portfolio manager: ${pm.summary || 'reviewed the trades.'}${pm.vetoes.length ? ` Vetoed: ${pm.vetoes.map((v) => `${v.asset} (${v.reason})`).join('; ')}.` : ' No vetoes.'}`, { cycle, vetoes: pm.vetoes });
        }
      }
      const { trades, notes } = decide(fund, finalSignals, { prices, fx, marketOpen });
      for (const t of trades) {
        const extra = t.side === 'SELL' ? ` — ${t.realized >= 0 ? 'profit' : 'loss'} ${eur(Math.abs(t.realized))} (${pct(t.realizedPct)})` : '';
        logEvent('trade', `${t.side} ${t.asset}: ${eur(t.value)} at $${+t.priceUsd.toFixed(4)}${extra}`, { cycle, trade: t });
      }
      for (const n of notes) logEvent('decision', n, { cycle });
      fund.lastTickAt = Date.now();
      const v = snapshot(fund, prices, fx);
      saveFund(fund);
      const day = Math.min(CONFIG.fund.durationDays, Math.floor((Date.now() - fund.startedAt) / 86400000) + 1);
      logEvent('cycle_end', `Cycle done: ${counts}. Fund ${eur(v.total)} (${pct(v.pnlPct)}) · ${v.holdings.length} holdings · cash ${eur(v.cash)} · day ${day}/${CONFIG.fund.durationDays}${marketOpen ? '' : ' · US market closed'}.`, { cycle, value: v.total, pnlPct: v.pnlPct });
      const lastDaily = getEvents({ limit: 3000 }).filter((e) => e.type === 'daily').pop();
      if (day > 1 && (!lastDaily || lastDaily.day < day)) {
        logEvent('daily', `Day ${day} of ${CONFIG.fund.durationDays}: ${eur(v.total)} (${pct(v.pnlPct)} since start), ${fund.trades.length} trades so far.`, { day, value: v.total, pnlPct: v.pnlPct });
      }
    } else {
      const why = fund.status === 'running' ? 'auto-trading is paused' : fund.status === 'ended' ? 'the challenge has ended' : 'no challenge running';
      logEvent('cycle_end', `Cycle done: ${counts}. No trading — ${why}.`, { cycle });
    }

    const g = await gradeDue();
    if (g) logEvent('graded', `Graded ${g} analyst calls that reached their ${CONFIG.horizonDays}-day horizon.`, { cycle });
    state.lastError = null;
    return { ok: true };
  } catch (e) {
    state.lastError = e.message;
    logEvent('error', `Cycle failed: ${e.message}`, { cycle });
    return { error: e.message };
  } finally {
    const cycleUsd = llmUsage().totalUsd - usdBefore;
    if (cycleUsd > 0) state.lastPaidCycleUsd = cycleUsd; // cached cycles cost 0 — keep the last real one
    state.phase = 'idle';
    state.progress = null;
    state.lastRunAt = Date.now();
    state.nextRunAt = state.lastRunAt + EVERY_MS;
  }
}

// Schedule: first cycle shortly after boot, then every EVERY_MS. A 1-minute
// watcher ends the challenge on time even between cycles.
export function startBot() {
  console.log(`  Bot: a cycle every ${CONFIG.signals.everyMin} min${CONFIG.signals.ntfyTopic ? ' (+ ntfy push)' : ''}.`);
  state.nextRunAt = Date.now() + 20000;
  setTimeout(() => runCycle({ reason: 'startup' }), 20000);
  setInterval(() => {
    if (Date.now() >= state.nextRunAt) runCycle();
    const f = loadFund();
    if (f.status === 'running' && Date.now() >= f.endsAt && state.phase !== 'thinking') finalize(f).catch((e) => logEvent('error', `Finalize failed: ${e.message}`));
  }, 60000);
}

export async function fundView() {
  const fund = loadFund();
  const fx = await getEurUsd();
  const assets = [...new Set([...Object.keys(fund.positions), ...Object.keys(fund.start?.prices || {})])];
  const prices = fund.status === 'running' ? await livePrices(assets) : {};
  const v = fund.status === 'ended' && fund.final ? { ...valuation(fund, {}, fx), total: fund.final.value, pnl: fund.final.pnl, pnlPct: fund.final.pnlPct, holdings: fund.final.holdings } : valuation(fund, prices, fx);
  const realized = fund.trades.filter((t) => t.side === 'SELL').reduce((s, t) => s + t.realized, 0);
  return {
    status: fund.status,
    base: fund.base,
    autoOn: fund.autoOn,
    durationDays: CONFIG.fund.durationDays,
    stopLossPct: CONFIG.fund.stopLossPct,
    startedAt: fund.startedAt,
    endsAt: fund.endsAt,
    lastTickAt: fund.lastTickAt,
    fx,
    marketOpen: usMarketOpen(),
    ...v,
    realized,
    fees: fund.trades.reduce((s, t) => s + t.fee, 0),
    benchmarks: fund.status === 'ended' && fund.final ? fund.final.benchmarks : benchmarks(fund, prices, fx),
    equity: fund.equity.slice(-400),
    trades: fund.trades.slice(-100).reverse(),
    tradeCount: fund.trades.length,
  };
}
