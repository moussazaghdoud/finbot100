// The Living Market Map: nodes (assets) + correlation edges + activity "pulse".
import { CONFIG } from '../config.js';
import { fetchSeries, buildEvidence, dailyReturns, correlation } from '../data/market.js';
import { getContext } from './context.js';

let cache = null,
  cacheTs = 0;

export async function getUniverse() {
  if (cache && Date.now() - cacheTs < 10 * 60000) return cache;

  const shared = await getContext().catch(() => null);
  const nodes = [];
  const returnsById = {};

  for (const meta of CONFIG.universe) {
    try {
      const { series } = await fetchSeries(meta.id);
      const ev = buildEvidence(meta, series);
      returnsById[meta.id] = dailyReturns(series, 20);
      const newsSent = shared
        ? meta.kind === 'crypto'
          ? shared.sentiment.crypto
          : shared.sentiment.stock
        : 0;
      nodes.push({
        id: meta.id,
        name: meta.name,
        sector: meta.sector,
        kind: meta.kind,
        country: meta.country,
        price: ev.price,
        ret3d: ev.ret3d,
        ret7d: ev.ret7d,
        ret30d: ev.ret30d,
        volatility: ev.volatility,
        // pulse: short-term activity intensity, 0..1
        pulse: Math.min(1, (Math.abs(ev.ret3d || 0) / 6 + ev.volatility / 6 + Math.abs(newsSent)) / 2),
      });
    } catch {
      /* skip an asset that fails to load */
    }
  }

  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = returnsById[nodes[i].id];
      const b = returnsById[nodes[j].id];
      if (!a || !b) continue;
      const c = correlation(a, b);
      if (Math.abs(c) >= 0.4) edges.push({ source: nodes[i].id, target: nodes[j].id, corr: c });
    }
  }

  cache = { nodes, edges, macro: shared?.macro || null, generatedAt: Date.now() };
  cacheTs = Date.now();
  return cache;
}
