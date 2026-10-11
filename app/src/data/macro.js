// Macro & sentiment context, shared by every asset in a cycle. All keyless:
// US Treasury yields (official CSV), VIX (Yahoo), EUR/USD (Binance), oil and
// Nasdaq (via the stock fetcher), crypto Fear & Greed (alternative.me).
import { fetchSeries, indexSeries, getEurUsd } from './market.js';

const TTL = 60 * 60 * 1000;
let cache = null;
const lastGood = {}; // name -> last successful value, reused (marked stale) if a source fails
const r2 = (n) => (n == null || !Number.isFinite(n) ? null : +n.toFixed(2));
const chg = (s, d) => (s?.length > d ? r2(((s[s.length - 1].close - s[s.length - 1 - d].close) / s[s.length - 1 - d].close) * 100) : null);

async function treasury() {
  const y = new Date().getUTCFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (finbot100)' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Treasury ${r.status}`);
  const [head, ...rows] = (await r.text()).trim().split('\n');
  const cols = head.split(',').map((c) => c.replace(/"/g, ''));
  const i10 = cols.indexOf('10 Yr'), i2 = cols.indexOf('2 Yr');
  const parse = (row) => { const c = row.split(','); return { date: c[0], y10: +c[i10], y2: +c[i2] }; };
  const now = parse(rows[0]), weekAgo = parse(rows[Math.min(5, rows.length - 1)]);
  return { date: now.date, us10y: now.y10, us2y: now.y2, curve10y2y: r2(now.y10 - now.y2), us10yChange5d: r2(now.y10 - weekAgo.y10) };
}

async function fearGreed() {
  const r = await fetch('https://api.alternative.me/fng/?limit=8');
  const d = (await r.json()).data;
  return { value: +d[0].value, label: d[0].value_classification, weekAgo: +d[7]?.value || null };
}

async function safe(name, fn, health) {
  try {
    const v = await fn();
    health[name] = 'ok';
    lastGood[name] = { v, t: Date.now() };
    return v;
  } catch (e) {
    const prev = lastGood[name];
    health[name] = prev ? `stale (${Math.round((Date.now() - prev.t) / 3600000)}h old): ${e.message.slice(0, 40)}` : e.message.slice(0, 60);
    return prev?.v ?? null;
  }
}

export async function getMacro() {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;
  const health = {};
  const [rates, vix, eurusd, oil, nasdaq, spy, gold, fng] = await Promise.all([
    safe('rates', treasury, health),
    safe('vix', () => indexSeries('^VIX'), health),
    safe('eurusd', getEurUsd, health),
    safe('oil', async () => (await fetchSeries('USO')).series, health),
    safe('nasdaq', async () => (await fetchSeries('QQQ')).series, health),
    safe('sp500', async () => (await fetchSeries('SPY')).series, health),
    safe('gold', async () => (await fetchSeries('GLD')).series, health),
    safe('fearGreed', fearGreed, health),
  ]);
  const sp30 = chg(spy, 21);
  const data = {
    rates,
    vix: vix ? { level: r2(vix[vix.length - 1].close), change5d: chg(vix, 5) } : null,
    eurusd: eurusd ? { rate: eurusd, note: 'higher = weaker dollar' } : null,
    oil: oil ? { change5d: chg(oil, 5), change30d: chg(oil, 21) } : null,
    nasdaq100: nasdaq ? { change5d: chg(nasdaq, 5), change30d: chg(nasdaq, 21) } : null,
    sp500: spy ? { change5d: chg(spy, 5), change30d: sp30 } : null,
    gold: gold ? { change5d: chg(gold, 5), change30d: chg(gold, 21) } : null,
    regime: sp30 == null ? 'unknown' : sp30 > 1.5 ? 'risk-on' : sp30 < -1.5 ? 'risk-off' : 'neutral',
    cryptoFearGreed: fng,
    health,
  };
  cache = { data, ts: Date.now() };
  return data;
}
