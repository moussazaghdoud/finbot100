// The virtual fund: cash + positions + trade ledger + equity curve.
// All simulated — no real money, no real broker. Trades execute at live prices.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../config.js';

const F = CONFIG.fund;

function ensureDir() {
  if (!existsSync(CONFIG.dataDir)) mkdirSync(CONFIG.dataDir, { recursive: true });
}

export function freshFund() {
  return {
    base: F.base,
    cash: F.base,
    positions: {}, // asset -> { qty, avgCost }
    trades: [], // newest last
    equity: [], // [{ t, value, cash, invested }]
    cursor: 0, // round-robin pointer for debate refresh
    startedAt: Date.now(),
    lastTickAt: null,
    autoOn: F.autoOn,
  };
}

export function loadFund() {
  if (!existsSync(CONFIG.fundFile)) return freshFund();
  try {
    return { ...freshFund(), ...JSON.parse(readFileSync(CONFIG.fundFile, 'utf8')) };
  } catch {
    return freshFund();
  }
}

export function saveFund(f) {
  ensureDir();
  writeFileSync(CONFIG.fundFile, JSON.stringify(f, null, 2));
}

// Current mark-to-market value of the fund given a price map { asset: price }.
export function valuation(fund, prices) {
  let invested = 0;
  const holdings = [];
  for (const [asset, pos] of Object.entries(fund.positions)) {
    if (!pos.qty) continue;
    const price = prices[asset] ?? pos.avgCost;
    const value = pos.qty * price;
    invested += value;
    holdings.push({
      asset,
      qty: pos.qty,
      avgCost: pos.avgCost,
      price,
      value,
      pnl: value - pos.qty * pos.avgCost,
      pnlPct: pos.avgCost ? ((price - pos.avgCost) / pos.avgCost) * 100 : 0,
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

export function buy(fund, asset, euros, price, reason, signal) {
  const fee = euros * (F.feePct / 100);
  const net = euros - fee;
  const qty = net / price;
  if (qty <= 0) return null;
  fund.cash -= euros;
  const pos = (fund.positions[asset] ||= { qty: 0, avgCost: 0 });
  const newQty = pos.qty + qty;
  pos.avgCost = (pos.qty * pos.avgCost + qty * price) / newQty;
  pos.qty = newQty;
  const trade = { id: randomUUID(), t: Date.now(), asset, side: 'BUY', qty, price, value: euros, fee, reason, signal };
  fund.trades.push(trade);
  return trade;
}

export function sell(fund, asset, qty, price, reason, signal) {
  const pos = fund.positions[asset];
  if (!pos || qty <= 0) return null;
  qty = Math.min(qty, pos.qty);
  const gross = qty * price;
  const fee = gross * (F.feePct / 100);
  fund.cash += gross - fee;
  pos.qty -= qty;
  if (pos.qty < 1e-9) delete fund.positions[asset];
  const trade = { id: randomUUID(), t: Date.now(), asset, side: 'SELL', qty, price, value: gross, fee, reason, signal };
  fund.trades.push(trade);
  return trade;
}

export function snapshot(fund, prices) {
  const v = valuation(fund, prices);
  fund.equity.push({ t: Date.now(), value: +v.total.toFixed(2), cash: +v.cash.toFixed(2), invested: +v.invested.toFixed(2) });
  if (fund.equity.length > 1000) fund.equity = fund.equity.slice(-1000);
  return v;
}
