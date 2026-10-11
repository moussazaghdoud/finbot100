// The Auto-Trader: turns the current BUY/SELL/HOLD signals into trades in the
// virtual fund, and explains every decision — including deciding to do nothing.
import { CONFIG, assetById } from '../config.js';
import { valuation, buy, sell } from './portfolio.js';

const F = CONFIG.fund;
const S = CONFIG.signals;

const votes = (s) => `${s.votes.bull}↑ ${s.votes.bear}↓ ${s.votes.neutral}–`;
const isStock = (a) => assetById(a)?.kind === 'stock';

// signals: output of getSignals(); ctx: { prices: {asset: usd}, fx, marketOpen }
// Returns { trades, notes } — notes are plain-language reasons for non-trades.
export function decide(fund, signals, { prices, fx, marketOpen }) {
  const by = Object.fromEntries(signals.filter((s) => !s.error).map((s) => [s.asset, s]));
  const trades = [];
  const notes = [];
  const closed = (a) => isStock(a) && !marketOpen;

  // 1) SELLs first (free up cash): a SELL signal, or the stop-loss.
  for (const [a, pos] of Object.entries(fund.positions)) {
    const s = by[a];
    const p = prices[a];
    if (!p) { notes.push(`${a}: no live price, can't act on it this round.`); continue; }
    const pnlPct = ((p / fx - pos.avgCostEur) / pos.avgCostEur) * 100;
    let why = null;
    if (s?.action === 'SELL') {
      why = { rule: 'signal', headline: `Sell signal (${votes(s)}, strength ${s.strength})`, reason: s.reason, risk: s.risk, score: s.score, theses: s.theses };
    } else if (pnlPct <= -F.stopLossPct) {
      why = { rule: 'stop-loss', headline: `Stop-loss: down ${Math.abs(pnlPct).toFixed(1)}% from cost`, reason: `Holding fell past the -${F.stopLossPct}% stop-loss, so the bot cuts the loss instead of hoping for a rebound.`, risk: s ? `Analysts now: ${votes(s)} (${s.action}).` : '', score: s?.score ?? null };
    }
    if (!why) continue;
    if (closed(a)) { notes.push(`${a}: wants to sell (${why.rule}) but the US market is closed — will retry when it opens.`); continue; }
    const t = sell(fund, a, pos.qty, p, fx, why);
    if (t) trades.push(t);
  }

  // 2) BUYs — strongest BUY signals first, respecting cash and the per-asset cap.
  const candidates = signals.filter((s) => !s.error && s.action === 'BUY').sort((x, y) => y.score - x.score);
  for (const s of candidates) {
    const a = s.asset;
    if (closed(a)) { notes.push(`${a}: buy signal, but the US market is closed — will reconsider when it opens.`); continue; }
    if (!prices[a]) { notes.push(`${a}: buy signal, but no live price right now.`); continue; }
    const v = valuation(fund, prices, fx);
    const posValue = fund.positions[a] ? (fund.positions[a].qty * prices[a]) / fx : 0;
    const room = v.total * F.maxWeight - posValue;
    const spend = Math.min(fund.cash, v.total * F.tradeFraction, room);
    if (spend < F.minTrade) {
      notes.push(room < F.minTrade ? `${a}: buy signal, but already at the ${F.maxWeight * 100}% max weight.` : `${a}: buy signal, but not enough cash left (€${fund.cash.toFixed(2)}).`);
      continue;
    }
    const why = { rule: 'signal', headline: `Buy signal (${votes(s)}, strength ${s.strength})`, reason: s.reason, risk: s.risk, score: s.score, theses: s.theses };
    const t = buy(fund, a, spend, prices[a], fx, why);
    if (t) trades.push(t);
  }

  for (const s of signals.filter((x) => x.vetoed)) notes.push(`${s.asset}: ${s.vetoedAction} vetoed by the portfolio manager — ${s.vetoed}`);
  if (!trades.length && !notes.length) {
    const best = signals.filter((s) => !s.error).sort((x, y) => y.score - x.score)[0];
    const worstHeld = Object.keys(fund.positions).map((a) => by[a]).filter(Boolean).sort((x, y) => x.score - y.score)[0];
    let n = 'No trade: no asset got a BUY decision';
    if (best) n += ` — the most bullish was ${best.asset} (${best.action}, strength ${best.strength}${best.via === 'claude' ? '' : `, rules need ${Math.round(S.buyThreshold * 100)}`})`;
    if (worstHeld) n += `; holdings stay — weakest is ${worstHeld.asset} (${worstHeld.action}), no SELL signal or stop-loss hit`;
    notes.push(n + '.');
  }
  return { trades, notes };
}
