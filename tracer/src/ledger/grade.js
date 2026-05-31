// Auto-grading: resolve any prediction whose horizon has passed, against the
// real BTC price at resolution time, and score it (correct? + Brier score).
import { CONFIG } from '../config.js';

function judge(stance, retPct) {
  if (stance === 'bullish') return retPct > CONFIG.bullBand;
  if (stance === 'bearish') return retPct < -CONFIG.bearBand;
  return Math.abs(retPct) <= CONFIG.neutralBand; // neutral
}

// series: array of {t, close} covering history; currentPrice/currentTs: latest.
export function gradePrediction(p, series, currentPrice, currentTs, closeNearest) {
  let priceAtResolve;
  if (p.resolveAt <= currentTs) {
    // Use the historical close nearest the resolve time if we have it,
    // otherwise fall back to the current price.
    const n = closeNearest(series, p.resolveAt);
    priceAtResolve = n.withinDay ? n.close : currentPrice;
  } else {
    return null; // not due yet
  }
  const ret = ((priceAtResolve - p.priceAtCall) / p.priceAtCall) * 100;
  const correct = judge(p.stance, ret);
  const pProb = p.confidence / 100;
  const outcome = correct ? 1 : 0;
  const brier = (pProb - outcome) ** 2;
  return {
    ...p,
    resolved: true,
    priceAtResolve,
    actualReturn: +ret.toFixed(2),
    correct,
    brier: +brier.toFixed(4),
  };
}
