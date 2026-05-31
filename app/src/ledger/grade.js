import { CONFIG } from '../config.js';
import { fetchSeries, closeNearest } from '../data/market.js';
import { loadPredictions, savePredictions } from './store.js';

function judge(stance, ret) {
  if (stance === 'bullish') return ret > CONFIG.bullBand;
  if (stance === 'bearish') return ret < -CONFIG.bearBand;
  return Math.abs(ret) <= CONFIG.neutralBand;
}

// Grade all due predictions across all assets. Returns count graded.
export async function gradeDue() {
  const preds = loadPredictions();
  const due = preds.filter((p) => !p.resolved && p.resolveAt <= Date.now());
  if (!due.length) return 0;

  const assets = [...new Set(due.map((p) => p.asset))];
  const seriesByAsset = {};
  for (const a of assets) {
    try {
      seriesByAsset[a] = (await fetchSeries(a)).series;
    } catch {
      /* skip assets we cannot price right now */
    }
  }

  let graded = 0;
  for (const p of preds) {
    if (p.resolved || p.resolveAt > Date.now()) continue;
    const series = seriesByAsset[p.asset];
    if (!series) continue;
    const last = series[series.length - 1];
    const n = closeNearest(series, p.resolveAt);
    const priceAtResolve = n.withinDay ? n.close : last.close;
    const ret = ((priceAtResolve - p.priceAtCall) / p.priceAtCall) * 100;
    const correct = judge(p.stance, ret);
    const brier = (p.confidence / 100 - (correct ? 1 : 0)) ** 2;
    p.resolved = true;
    p.priceAtResolve = priceAtResolve;
    p.actualReturn = +ret.toFixed(2);
    p.correct = correct;
    p.brier = +brier.toFixed(4);
    graded++;
  }
  savePredictions(preds);
  return graded;
}
