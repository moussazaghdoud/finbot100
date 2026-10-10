// Unified market data: crypto via Binance/CoinGecko (keyless), stocks/ETFs via
// Stooq CSV (keyless). Returns a daily-close series per asset. All real data.
import { CONFIG, assetById } from '../config.js';

const DAY_MS = 86400000;
const cache = new Map(); // id -> { series, source, ts }
const TTL = 15 * 60 * 1000;
const HISTORY = 100; // daily bars kept: enough to grade calls and backtest ~2 months

async function binanceDaily(symbol, limit = HISTORY) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  const rows = await r.json();
  return rows.map((x) => ({ t: x[0], close: +x[4], high: +x[2], low: +x[3] }));
}

async function coingeckoDaily(id, days = HISTORY) {
  const map = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
    XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano',
  };
  const url = `https://api.coingecko.com/api/v3/coins/${map[id]}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = await r.json();
  return j.prices.map(([t, c]) => ({ t, close: c, high: c, low: c }));
}

async function yahooDaily(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (finbot100)' } });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res?.timestamp) throw new Error('Yahoo: no data');
  const q = res.indicators.quote[0];
  const rows = res.timestamp
    .map((ts, i) => ({ t: ts * 1000, close: q.close[i], high: q.high[i], low: q.low[i] }))
    .filter((x) => x.close != null);
  return rows.slice(-HISTORY);
}

async function twelveDataDaily(symbol, key) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${HISTORY + 5}&apikey=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TwelveData ${r.status}`);
  const j = await r.json();
  if (j.status === 'error' || !Array.isArray(j.values)) throw new Error(`TwelveData: ${j.message || 'no data'}`);
  // values are newest-first — reverse to oldest-first
  return j.values
    .map((v) => ({ t: new Date(v.datetime).getTime(), close: +v.close, high: +v.high, low: +v.low }))
    .filter((x) => Number.isFinite(x.close))
    .reverse()
    .slice(-HISTORY);
}

// Stocks/ETFs: prefer Twelve Data when a key is set (works from cloud),
// otherwise fall back to Yahoo (works locally, blocked on most cloud hosts).
async function stockDaily(id) {
  if (CONFIG.stockApiKey) {
    try {
      return await twelveDataDaily(id, CONFIG.stockApiKey);
    } catch (e) {
      // fall through to Yahoo as a backup
    }
  }
  return yahooDaily(id);
}

// Live "spot" price (USD) for trading and marking the fund to market.
// Crypto: Binance instant ticker. Stocks: live quote (Twelve Data if a key is
// set, else Yahoo's regularMarketPrice). Falls back to the latest daily close.
const spotCache = new Map(); // id -> { p, ts }
const SPOT_TTL = 60 * 1000;

async function stockQuote(id) {
  if (CONFIG.stockApiKey) {
    try {
      const r = await fetch(`https://api.twelvedata.com/price?symbol=${id}&apikey=${CONFIG.stockApiKey}`);
      const p = Number((await r.json()).price);
      if (p > 0) return p;
    } catch {}
  }
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${id}?range=1d&interval=1m`, { headers: { 'user-agent': 'Mozilla/5.0 (finbot100)' } });
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const p = Number((await r.json())?.chart?.result?.[0]?.meta?.regularMarketPrice);
  if (!(p > 0)) throw new Error('Yahoo: no quote');
  return p;
}

export async function getSpot(id) {
  const c = spotCache.get(id);
  if (c && Date.now() - c.ts < SPOT_TTL) return c.p;
  const meta = assetById(id);
  let p = null;
  try {
    if (meta.kind === 'crypto') {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${id}USDT`);
      if (r.ok) p = Number((await r.json()).price) || null;
    } else {
      p = await stockQuote(id);
    }
  } catch {
    /* fall through */
  }
  if (!p) {
    try {
      const { series } = await fetchSeries(id);
      p = series[series.length - 1].close;
    } catch {
      return c?.p ?? null;
    }
  }
  spotCache.set(id, { p, ts: Date.now() });
  return p;
}

// EUR→USD rate (how many USD one euro buys). Binance EURUSDT tracks EUR/USD
// closely and is keyless; falls back to the last known rate.
let fxCache = null;
export async function getEurUsd() {
  if (fxCache && Date.now() - fxCache.ts < SPOT_TTL) return fxCache.rate;
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
    const rate = Number((await r.json()).price);
    if (rate > 0.5 && rate < 2) {
      fxCache = { rate, ts: Date.now() };
      return rate;
    }
  } catch {}
  return fxCache?.rate ?? null;
}

// Is the US stock market open right now? (Mon–Fri 9:30–16:00 New York time;
// exchange holidays are not modelled.)
export function usMarketOpen(now = new Date()) {
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = ny.getDay();
  const mins = ny.getHours() * 60 + ny.getMinutes();
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
}

export async function fetchSeries(id) {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < TTL) return cached;

  const meta = assetById(id);
  let series, source;
  if (meta.kind === 'crypto') {
    try {
      series = await binanceDaily(`${id}USDT`);
      source = 'Binance';
    } catch {
      series = await coingeckoDaily(id);
      source = 'CoinGecko';
    }
  } else {
    series = await stockDaily(id);
    source = CONFIG.stockApiKey ? 'TwelveData' : 'Yahoo';
  }
  if (!series?.length) throw new Error(`No data for ${id}`);
  const out = { series, source, ts: Date.now() };
  cache.set(id, out);
  return out;
}

function pct(a, b) {
  return ((a - b) / b) * 100;
}
function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function buildEvidence(meta, series, asOfIndex = series.length - 1) {
  const s = series.slice(0, asOfIndex + 1);
  const cur = s[s.length - 1];
  const at = (d) => s[s.length - 1 - d]?.close ?? null;
  const close = cur.close;
  const highs = s.slice(-30).map((x) => x.high ?? x.close);
  const lows = s.slice(-30).map((x) => x.low ?? x.close);
  const high30 = Math.max(...highs);
  const low30 = Math.min(...lows);
  const rets = [];
  for (let i = 1; i < s.length; i++) rets.push(pct(s[i].close, s[i - 1].close));
  return {
    asset: meta.id,
    name: meta.name,
    sector: meta.sector,
    asOf: cur.t,
    price: close,
    ret3d: at(3) != null ? +pct(close, at(3)).toFixed(2) : null,
    ret7d: at(7) != null ? +pct(close, at(7)).toFixed(2) : null,
    ret30d: at(30) != null ? +pct(close, at(30)).toFixed(2) : +pct(close, s[0].close).toFixed(2),
    volatility: +stdev(rets.slice(-14)).toFixed(2),
    high30,
    low30,
    pctFromHigh: +pct(close, high30).toFixed(2),
    pctFromLow: +pct(close, low30).toFixed(2),
    series: s.slice(-41).map((x) => ({ t: x.t, close: x.close })),
  };
}

export function closeNearest(series, tsMs) {
  let best = series[0],
    bd = Infinity;
  for (const p of series) {
    const d = Math.abs(p.t - tsMs);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return { close: best.close, t: best.t, withinDay: bd <= DAY_MS };
}

// Daily returns aligned by index (for correlation). Returns last n returns.
export function dailyReturns(series, n = 20) {
  const r = [];
  for (let i = 1; i < series.length; i++) r.push(pct(series[i].close, series[i - 1].close));
  return r.slice(-n);
}

export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const x = a.slice(-n),
    y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return 0;
  return +(num / Math.sqrt(dx * dy)).toFixed(2);
}
