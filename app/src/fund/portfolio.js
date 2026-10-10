// The virtual fund: € cash + positions + trade ledger + equity curve, run as a
// fixed-length challenge. All simulated — no real money, no real broker.
// Assets are priced in USD; every trade converts at the live EUR/USD rate, so
// the € result includes currency moves like it would for a real € investor.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../config.js';

const F = CONFIG.fund;

function ensureDir() {
  if (!existsSync(CONFIG.dataDir)) mkdirSync(CONFIG.dataDir, { recursive: true });
}

// status: 'idle' (no challenge yet) | 'running' | 'ended'
export function freshFund() {
  return {
    status: 'idle',
    base: F.base,
    cash: F.base, // €
    positions: {}, // asset -> { qty, avgCostEur } (avgCostEur = € paid per unit incl. FX)
    trades: [], // newest last
    equity: [], // [{ t, value, cash, invested }] in €
    startedAt: null,
    endsAt: null,
    start: null, // { prices: {asset: usd}, fx } — baseline for benchmarks
    final: null, // frozen result once ended
    lastTickAt: null,
    autoOn: F.autoOn,
  };
}

export function startChallenge() {
  const f = freshFund();
  f.status = 'running';
  f.startedAt = Date.now();
  f.endsAt = f.startedAt + F.durationDays * 86400000;
  return f;
}

export function loadFund() {
  if (!existsSync(CONFIG.fundFile)) return freshFund();
  try {
    const raw = JSON.parse(readFileSync(CONFIG.fundFile, 'utf8'));
    if (!raw.status) {
      // Pre-challenge fund format: archive it, start clean.
      renameSync(CONFIG.fundFile, CONFIG.fundFile.replace(/\.json$/, `.legacy-${Date.now()}.json`));
      return freshFund();
    }
    return { ...freshFund(), ...raw };
  } catch {
    return freshFund();
  }
}

export function saveFund(f) {
  ensureDir();
  writeFileSync(CONFIG.fundFile, JSON.stringify(f, null, 2));
}

// Mark-to-market in € given { asset: usdPrice } and the EUR/USD rate.
export function valuation(fund, prices, fx) {
  let invested = 0;
  const holdings = [];
  for (const [asset, pos] of Object.entries(fund.positions)) {
    if (!pos.qty) continue;
    const priceEur = prices[asset] && fx ? prices[asset] / fx : pos.avgCostEur;
    const value = pos.qty * priceEur;
    invested += value;
    holdings.push({
      asset,
      qty: pos.qty,
      avgCostEur: pos.avgCostEur,
      priceUsd: prices[asset] ?? null,
      value,
      pnl: value - pos.qty * pos.avgCostEur,
      pnlPct: pos.avgCostEur ? ((priceEur - pos.avgCostEur) / pos.avgCostEur) * 100 : 0,
      boughtAt: pos.boughtAt,
    });
  }
  const total = fund.cash + invested;
  return {
    cash: fund.cash,
    invested,
    total,
    pnl: total - fund.base,
    pnlPct: ((total - fund.base) / fund.base) * 100,
    holdings: holdings.sort((a, b) => b.value - a.value),
  };
}

export function buy(fund, asset, euros, priceUsd, fx, why) {
  const fee = euros * (F.feePct / 100);
  const qty = ((euros - fee) * fx) / priceUsd;
  if (qty <= 0) return null;
  fund.cash -= euros;
  const pos = (fund.positions[asset] ||= { qty: 0, avgCostEur: 0, boughtAt: Date.now() });
  const newQty = pos.qty + qty;
  pos.avgCostEur = (pos.qty * pos.avgCostEur + euros) / newQty;
  pos.qty = newQty;
  const trade = { id: randomUUID(), t: Date.now(), asset, side: 'BUY', qty, priceUsd, fx, value: euros, fee, ...why };
  fund.trades.push(trade);
  return trade;
}

export function sell(fund, asset, qty, priceUsd, fx, why) {
  const pos = fund.positions[asset];
  if (!pos || qty <= 0) return null;
  qty = Math.min(qty, pos.qty);
  const gross = (qty * priceUsd) / fx;
  const fee = gross * (F.feePct / 100);
  const costBasis = qty * pos.avgCostEur;
  const realized = gross - fee - costBasis;
  fund.cash += gross - fee;
  pos.qty -= qty;
  if (pos.qty < 1e-9) delete fund.positions[asset];
  const trade = { id: randomUUID(), t: Date.now(), asset, side: 'SELL', qty, priceUsd, fx, value: gross, fee, realized, realizedPct: (realized / costBasis) * 100, ...why };
  fund.trades.push(trade);
  return trade;
}

export function snapshot(fund, prices, fx) {
  const v = valuation(fund, prices, fx);
  fund.equity.push({ t: Date.now(), value: +v.total.toFixed(2), cash: +v.cash.toFixed(2), invested: +v.invested.toFixed(2) });
  if (fund.equity.length > 2000) fund.equity = fund.equity.slice(-2000);
  return v;
}

// What €base would be worth if simply held in a benchmark since the start.
export function benchmarks(fund, prices, fx) {
  if (!fund.start || !fx) return [];
  const ratio = (a) => (fund.start.prices[a] && prices[a] ? (prices[a] / fund.start.prices[a]) * (fund.start.fx / fx) : null);
  const out = [{ id: 'cash', label: 'Kept as cash', value: fund.base }];
  for (const [id, label] of [['BTC', 'Just held Bitcoin'], ['SPY', 'Just held the S&P 500']]) {
    const r = ratio(id);
    if (r) out.push({ id, label, value: fund.base * r });
  }
  const rs = Object.keys(fund.start.prices).map(ratio).filter(Boolean);
  if (rs.length) out.push({ id: 'all', label: `Split equally across all ${rs.length}`, value: (fund.base * rs.reduce((s, x) => s + x, 0)) / rs.length });
  return out.map((b) => ({ ...b, value: +b.value.toFixed(2), pnlPct: +(((b.value - fund.base) / fund.base) * 100).toFixed(2) }));
}
