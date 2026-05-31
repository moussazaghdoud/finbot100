// Backfill the ledger with real, already-resolvable historical agent calls so
// the Accountability Ledger is meaningful on first launch (instead of empty for
// 3 days). Uses real past prices; agents reason (mock) on the evidence as it
// stood each day. Honest, reproducible, cheap (no API calls).
import { CONFIG, assetById } from '../config.js';
import { fetchSeries, buildEvidence } from '../data/market.js';
import { runSage, runOracle, runScout, runSentinel, runAtlas, runAlchemist, setForceMock } from '../agents/council.js';
import { makePrediction, appendPredictions, loadPredictions } from '../ledger/store.js';

const NEUTRAL = { macro: { regime: 'neutral', market30d: 0, gold30d: 0 }, geo: { score: 0, flag: false }, news: [], sentiment: 0 };

export async function seedHistoryIfEmpty() {
  if (loadPredictions().length) return 0;
  setForceMock(true);
  const all = [];
  for (const meta of CONFIG.universe) {
    let series;
    try {
      series = (await fetchSeries(meta.id)).series;
    } catch {
      continue;
    }
    for (let i = series.length - 11; i <= series.length - 4; i++) {
      if (i < 8) continue;
      const ev = buildEvidence(meta, series, i);
      const createdAt = series[i].t;
      const partial = [
        await runSage(ev, NEUTRAL),
        await runOracle(ev, NEUTRAL),
        await runScout(ev, NEUTRAL),
        await runSentinel(ev, NEUTRAL),
        await runAtlas(ev, NEUTRAL),
      ];
      const alch = await runAlchemist(ev, { ...NEUTRAL, council: partial });
      for (const t of [...partial, alch]) all.push(makePrediction(t, meta.id, ev.price, 'agent', createdAt));
    }
  }
  setForceMock(false);
  appendPredictions(all);
  return all.length;
}
