// Backfill the ledger with real, already-resolvable historical agent calls (a
// backtest) so the track record is meaningful on first launch — and again after
// the app has been offline long enough for old calls to be voided. Uses real
// past prices; agents reason (mock rules) on the evidence as it stood each day.
// Honest, reproducible, cheap (no API calls). Calls are flagged `seeded`.
import { CONFIG } from '../config.js';
import { fetchSeries, buildEvidence } from '../data/market.js';
import { runSage, runOracle, runScout, runSentinel, runAtlas, runAlchemist, setForceMock } from '../agents/council.js';
import { makePrediction, appendPredictions, loadPredictions } from '../ledger/store.js';

const NEUTRAL = { macro: { regime: 'neutral', market30d: 0, gold30d: 0 }, geo: { score: 0, flag: false }, news: [], sentiment: 0 };
const FRESH_DAYS = 14; // re-seed if the newest backtest call is older than this

export async function seedHistoryIfEmpty() {
  const existing = loadPredictions();
  const newestSeed = Math.max(0, ...existing.filter((p) => p.seeded).map((p) => p.createdAt));
  if (Date.now() - newestSeed < FRESH_DAYS * 86400000) return 0;

  const have = new Set(existing.filter((p) => p.source === 'agent').map((p) => p.asset + '|' + new Date(p.createdAt).toDateString()));
  setForceMock(true);
  const all = [];
  try {
    for (const meta of CONFIG.universe) {
      let series;
      try {
        series = (await fetchSeries(meta.id)).series;
      } catch {
        continue;
      }
      // Need ~30 bars of look-back for the evidence, and the horizon must have passed.
      for (let i = Math.max(30, series.length - 1 - CONFIG.horizonDays - 70); i <= series.length - 1 - CONFIG.horizonDays; i++) {
        const createdAt = series[i].t;
        if (have.has(meta.id + '|' + new Date(createdAt).toDateString())) continue;
        const ev = buildEvidence(meta, series, i);
        const partial = [
          await runSage(ev, NEUTRAL),
          await runOracle(ev, NEUTRAL),
          await runScout(ev, NEUTRAL),
          await runSentinel(ev, NEUTRAL),
          await runAtlas(ev, NEUTRAL),
        ];
        const alch = await runAlchemist(ev, { ...NEUTRAL, council: partial });
        for (const t of [...partial, alch]) all.push({ ...makePrediction(t, meta.id, ev.price, 'agent', createdAt), seeded: true });
      }
    }
  } finally {
    setForceMock(false);
  }
  if (all.length) appendPredictions(all);
  return all.length;
}
