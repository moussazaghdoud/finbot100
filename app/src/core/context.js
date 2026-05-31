// Shared market context for a debate cycle: macro regime, geopolitical signal,
// and per-kind news. Computed from real data, cached briefly (shared compute).
import { CONFIG, assetById } from '../config.js';
import { fetchSeries, buildEvidence } from '../data/market.js';
import { fetchNews, sentiment } from '../data/news.js';

let cache = null;
let cacheTs = 0;

const GEO = /(war|sanction|tariff|conflict|attack|missile|invasion|election|coup|embargo|strike|geopolit)/i;

export async function getContext() {
  if (cache && Date.now() - cacheTs < CONFIG.debateCacheMin * 60000) return cache;

  // Broad market + gold for the macro regime.
  let market30d = 0,
    gold30d = 0;
  try {
    const spy = await fetchSeries('SPY');
    market30d = buildEvidence(assetById('SPY'), spy.series).ret30d ?? 0;
  } catch {}
  try {
    const gld = await fetchSeries('GLD');
    gold30d = buildEvidence(assetById('GLD'), gld.series).ret30d ?? 0;
  } catch {}
  const regime = market30d > 1.5 ? 'risk-on' : market30d < -1.5 ? 'risk-off' : 'neutral';

  const cryptoNews = await fetchNews('crypto');
  const stockNews = await fetchNews('stock');
  const allNews = [...stockNews, ...cryptoNews];

  const geoScore = allNews.length
    ? +(allNews.filter((n) => GEO.test(n.title)).length / allNews.length).toFixed(2)
    : 0;
  const geoBoost = gold30d > 2 ? 0.15 : 0;
  const geo = { score: +(geoScore + geoBoost).toFixed(2), flag: geoScore + geoBoost >= 0.3 };

  cache = {
    macro: { market30d: +market30d.toFixed(2), gold30d: +gold30d.toFixed(2), regime },
    geo,
    news: { crypto: cryptoNews, stock: stockNews },
    sentiment: { crypto: sentiment(cryptoNews), stock: sentiment(stockNews) },
  };
  cacheTs = Date.now();
  return cache;
}

export function ctxForAsset(asset, shared) {
  const isCrypto = assetById(asset).kind === 'crypto';
  return {
    macro: shared.macro,
    geo: shared.geo,
    news: isCrypto ? shared.news.crypto : shared.news.stock,
    sentiment: isCrypto ? shared.sentiment.crypto : shared.sentiment.stock,
  };
}
