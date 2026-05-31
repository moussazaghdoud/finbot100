// Calibration scoreboard — the product's trust spine.
export function scoreboard(predictions) {
  const resolved = predictions.filter((p) => p.resolved);
  const by = {};
  for (const p of resolved) {
    const k = p.agent;
    const a = (by[k] ||= { agent: k, source: p.source, n: 0, hits: 0, sumConf: 0, sumBrier: 0 });
    a.n++;
    a.hits += p.correct ? 1 : 0;
    a.sumConf += p.confidence;
    a.sumBrier += p.brier;
  }
  return Object.values(by)
    .map((a) => {
      const hitRate = (a.hits / a.n) * 100;
      const avgConf = a.sumConf / a.n;
      return {
        agent: a.agent,
        source: a.source,
        n: a.n,
        hitRate: +hitRate.toFixed(1),
        avgConfidence: +avgConf.toFixed(1),
        avgBrier: +(a.sumBrier / a.n).toFixed(4),
        calibrationGap: +(avgConf - hitRate).toFixed(1), // + = overconfident
      };
    })
    .sort((x, y) => x.avgBrier - y.avgBrier); // best calibrated first
}
