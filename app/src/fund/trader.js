// The Auto-Trader: turns the Analyst Council's debate into BUY/SELL/HOLD
// decisions and executes them in the virtual fund at live prices.
import { CONFIG } from '../config.js';
import { runDebate, getCachedBrief } from '../core/debate.js';
import { getSpot } from '../data/market.js';
import { loadFund, saveFund, valuation, buy, sell, snapshot } from './portfolio.js';

const F = CONFIG.fund;

// Council signal in -1..+1 (confidence-weighted net stance).
export function signalFromBrief(brief) {
  if (!brief?.theses?.length) return 0;
  let s = 0;
  for (const t of brief.theses) s += t.stance === 'bullish' ? t.confidence : t.stance === 'bearish' ? -t.confidence : 0;
  return +(s / (brief.theses.length * 90)).toFixed(3);
}

function lean(brief) {
  const b = brief.theses.filter((t) => t.stance === 'bullish').length;
  const r = brief.theses.filter((t) => t.stance === 'bearish').length;
  return `${b}↑/${r}↓`;
}

let ticking = false;

export async function tick({ force = false } = {}) {
  if (ticking) return { skipped: 'a cycle is already running' };
  ticking = true;
  try {
    const fund = loadFund();
    const assets = CONFIG.universe.map((a) => a.id);
    const bootstrap = fund.trades.length === 0;

    // Decide which assets get a fresh debate this cycle (cost control):
    // bootstrap → all; otherwise → one round-robin asset + all current holdings.
    const held = Object.keys(fund.positions).filter((a) => fund.positions[a]?.qty);
    const toRefresh = bootstrap ? assets : [assets[fund.cursor % assets.length], ...held];
    fund.cursor = (fund.cursor + 1) % assets.length;

    const briefs = {};
    for (const a of assets) {
      const refresh = toRefresh.includes(a);
      const brief = refresh ? await runDebate(a, { force: bootstrap ? false : refresh }) : getCachedBrief(a);
      if (brief) briefs[a] = brief;
    }

    // Live prices for everything we might value or trade.
    const prices = {};
    for (const a of new Set([...Object.keys(briefs), ...held])) {
      const p = await getSpot(a);
      if (p) prices[a] = p;
    }

    const decisions = [];

    // 1) SELLs first (free up cash) — strong bearish signal on a holding.
    for (const a of held) {
      const brief = briefs[a];
      if (!brief || !prices[a]) continue;
      const sig = signalFromBrief(brief);
      if (sig <= -F.sellThreshold) {
        const pos = fund.positions[a];
        const t = sell(fund, a, pos.qty, prices[a], `Council ${lean(brief)} · signal ${sig}`, sig);
        if (t) decisions.push(t);
      }
    }

    // 2) BUYs — best signals first, respecting cash and per-asset weight cap.
    const buyable = Object.keys(briefs)
      .map((a) => ({ a, sig: signalFromBrief(briefs[a]) }))
      .filter((x) => x.sig >= F.buyThreshold && prices[x.a])
      .sort((x, y) => y.sig - x.sig);

    for (const { a, sig } of buyable) {
      const v = valuation(fund, prices);
      const posValue = (fund.positions[a]?.qty || 0) * prices[a];
      const room = v.total * F.maxWeight - posValue; // weight cap headroom
      const spend = Math.min(fund.cash, v.total * F.tradeFraction, room);
      if (spend >= F.minTrade) {
        const t = buy(fund, a, spend, prices[a], `Council ${lean(briefs[a])} · signal ${sig}`, sig);
        if (t) decisions.push(t);
      }
    }

    const v = snapshot(fund, prices);
    fund.lastTickAt = Date.now();
    saveFund(fund);
    return { trades: decisions, valuation: v, bootstrap, evaluated: Object.keys(briefs).length };
  } finally {
    ticking = false;
  }
}
