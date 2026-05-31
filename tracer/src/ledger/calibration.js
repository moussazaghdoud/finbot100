// Calibration = the heart of FinBot's trust pitch. Not just "how often right",
// but "when an agent says 70%, does it happen ~70% of the time?"

export function calibrationByAgent(predictions) {
  const resolved = predictions.filter((p) => p.resolved);
  const byAgent = {};
  for (const p of resolved) {
    const a = (byAgent[p.agent] ||= { agent: p.agent, n: 0, hits: 0, sumConf: 0, sumBrier: 0, bands: {} });
    a.n += 1;
    a.hits += p.correct ? 1 : 0;
    a.sumConf += p.confidence;
    a.sumBrier += p.brier;
    // confidence bands of 10
    const band = `${Math.floor(p.confidence / 10) * 10}-${Math.floor(p.confidence / 10) * 10 + 9}`;
    const b = (a.bands[band] ||= { n: 0, hits: 0 });
    b.n += 1;
    b.hits += p.correct ? 1 : 0;
  }
  return Object.values(byAgent).map((a) => ({
    agent: a.agent,
    n: a.n,
    hitRate: a.n ? +((a.hits / a.n) * 100).toFixed(1) : null,
    avgConfidence: a.n ? +(a.sumConf / a.n).toFixed(1) : null,
    avgBrier: a.n ? +(a.sumBrier / a.n).toFixed(4) : null, // lower is better (0 = perfect)
    // calibration gap: stated confidence minus realized hit-rate (≈0 = well calibrated)
    calibrationGap: a.n ? +(a.sumConf / a.n - (a.hits / a.n) * 100).toFixed(1) : null,
    bands: a.bands,
  }));
}
