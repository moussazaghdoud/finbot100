import { CONFIG } from '../config.js';
import { fetchSeries, closeNearest } from '../data/market.js';
import { loadPredictions, savePredictions } from './store.js';

function judge(stance, ret) {
  if (stance === 'bullish') return ret > CONFIG.bullBand;
  if (stance === 'bearish') return ret < -CONFIG.bearBand;
  return Math.abs(ret) <= CONFIG.neutralBand;
}

// Grade one prediction against the close on its resolve day. If that day is
// outside the price history we have (e.g. the app was offline for weeks), the
// call is voided — never graded against a later price.
function gradeOne(p, series) {
  const n = closeNearest(series, p.resolveAt);
  p.resolved = true;
  p.gradedAt = Date.now();
  if (!n.withinDay) {
    Object.assign(p, { void: true, priceAtResolve: null, actualReturn: null, correct: null, brier: null });
    return;
  }
  const ret = ((n.close - p.priceAtCall) / p.priceAtCall) * 100;
  const correct = judge(p.stance, ret);
  p.void = false;
  p.priceAtResolve = n.close;
  p.actualReturn = +ret.toFixed(2);
  p.correct = correct;
  p.brier = +((p.confidence / 100 - (correct ? 1 : 0)) ** 2).toFixed(4);
}

// Grade all due predictions across all assets (plus a one-time re-check of
// calls graded before gradedAt existed). Returns count graded.
export async function gradeDue() {
  const preds = loadPredictions();
  const todo = preds.filter((p) => (!p.resolved && p.resolveAt <= Date.now()) || (p.resolved && !p.gradedAt));
  if (!todo.length) return 0;

  const seriesByAsset = {};
  for (const a of new Set(todo.map((p) => p.asset))) {
    try {
      seriesByAsset[a] = (await fetchSeries(a)).series;
    } catch {
      /* skip assets we cannot price right now */
    }
  }

  let graded = 0;
  for (const p of todo) {
    const series = seriesByAsset[p.asset];
    if (!series) continue;
    gradeOne(p, series);
    graded++;
  }
  savePredictions(preds);
  return graded;
}
