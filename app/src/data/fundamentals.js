// Company fundamentals from Financial Modeling Prep (free key, FMP_API_KEY):
// valuation, profitability, growth, next earnings date, analyst targets.
// Cached 24h per symbol (they change slowly; the free tier allows ~250 calls/day).
// Field names differ between FMP endpoint versions, so known names are picked
// tolerantly and anything missing is simply left out.
import { CONFIG } from '../config.js';

const TTL = 24 * 3600 * 1000;
const cache = new Map();
const BASE = 'https://financialmodelingprep.com/stable';

async function get(path) {
  const r = await fetch(`${BASE}/${path}${path.includes('?') ? '&' : '?'}apikey=${CONFIG.fmpApiKey}`);
  if (!r.ok) throw new Error(`FMP ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [j];
}

const r2 = (n) => (n == null || n === '' || !Number.isFinite(+n) ? null : +(+n).toFixed(2));
function pick(obj, names) {
  for (const n of names) if (obj?.[n] != null && obj[n] !== '') return obj[n];
  return null;
}

export async function getFundamentals(meta) {
  if (!CONFIG.fmpApiKey || meta.kind !== 'stock' || ['SPY', 'GLD'].includes(meta.id)) return null;
  const c = cache.get(meta.id);
  if (c && Date.now() - c.ts < TTL) return c.data;
  const s = meta.id;
  const [profile, ratios, growth, target, earnings] = await Promise.all([
    get(`profile?symbol=${s}`).catch(() => []),
    get(`ratios-ttm?symbol=${s}`).catch(() => []),
    get(`financial-growth?symbol=${s}&limit=1`).catch(() => []),
    get(`price-target-consensus?symbol=${s}`).catch(() => []),
    get(`earnings?symbol=${s}&limit=6`).catch(() => []),
  ]);
  const p = profile[0] || {}, ra = ratios[0] || {}, g = growth[0] || {}, t = target[0] || {};
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = earnings.filter((e) => e.date >= today && e.epsActual == null).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const last = earnings.filter((e) => e.epsActual != null).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const data = {
    marketCapB: r2(pick(p, ['marketCap', 'mktCap']) / 1e9),
    beta: r2(pick(p, ['beta'])),
    peTTM: r2(pick(ra, ['priceToEarningsRatioTTM', 'peRatioTTM'])),
    pegTTM: r2(pick(ra, ['priceToEarningsGrowthRatioTTM', 'pegRatioTTM'])),
    priceToSalesTTM: r2(pick(ra, ['priceToSalesRatioTTM'])),
    netMarginPct: r2(pick(ra, ['netProfitMarginTTM']) * 100),
    debtToEquity: r2(pick(ra, ['debtToEquityRatioTTM', 'debtEquityRatioTTM'])),
    revenueGrowthPct: r2(pick(g, ['revenueGrowth']) * 100),
    epsGrowthPct: r2(pick(g, ['epsgrowth', 'epsGrowth']) * 100),
    analystTarget: r2(pick(t, ['targetConsensus', 'targetMedian'])),
    analystTargetHigh: r2(pick(t, ['targetHigh'])),
    analystTargetLow: r2(pick(t, ['targetLow'])),
    nextEarnings: upcoming ? { date: upcoming.date, epsEstimate: r2(upcoming.epsEstimated) } : null,
    lastEarnings: last ? { date: last.date, epsActual: r2(last.epsActual), epsEstimate: r2(last.epsEstimated) } : null,
  };
  const filled = Object.values(data).filter((v) => v != null).length;
  if (!filled) throw new Error('FMP returned no usable fields (check FMP_API_KEY / plan)');
  cache.set(meta.id, { data, ts: Date.now() });
  return data;
}
