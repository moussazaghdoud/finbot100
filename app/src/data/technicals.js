// Technical indicators computed from the daily series (no external calls).
const r2 = (n) => (n == null || !Number.isFinite(n) ? null : +n.toFixed(2));
const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
const sma = (xs, n) => (xs.length >= n ? xs.slice(-n).reduce((s, x) => s + x, 0) / n : null);

function ema(xs, n) {
  if (xs.length < n) return [];
  const k = 2 / (n + 1);
  let e = xs.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const out = [e];
  for (let i = n; i < xs.length; i++) out.push((e = xs[i] * k + e * (1 - k)));
  return out;
}

function rsi(closes, n = 14) {
  if (closes.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function technicals(series) {
  const closes = series.map((x) => x.close);
  const price = closes[closes.length - 1];
  const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  let macdHist = null;
  if (e26.length > 9) {
    const macd = e26.map((v, i) => e12[i + 14] - v); // align: ema12 starts 14 bars earlier
    const signal = ema(macd, 9);
    macdHist = macd[macd.length - 1] - signal[signal.length - 1];
  }
  const yr = closes.slice(-250);
  const vols = series.map((x) => x.volume).filter((v) => v > 0);
  const volRatio = vols.length >= 20 ? sma(vols, 5) / sma(vols, 20) : null;
  return {
    rsi14: r2(rsi(closes)),
    vsSma20: r2(pct(price, s20)),
    vsSma50: r2(pct(price, s50)),
    vsSma200: r2(pct(price, s200)),
    trend: s50 && s200 ? (s50 > s200 ? 'golden cross (50d above 200d — long-term uptrend)' : 'death cross (50d below 200d — long-term downtrend)') : 'n/a (under 200 days of data)',
    macdHist: r2(macdHist),
    macdHistPct: r2(macdHist != null ? (macdHist / price) * 100 : null),
    from52wHigh: r2(pct(price, Math.max(...yr))),
    from52wLow: r2(pct(price, Math.min(...yr))),
    volume5dVs20d: r2(volRatio),
    days: closes.length,
  };
}

// Pearson correlation of the last n daily returns of two series, aligned by date.
export function correlationByDate(a, b, n = 60) {
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  const mb = new Map(b.map((x) => [day(x.t), x.close]));
  const pairs = [];
  for (let i = 1; i < a.length; i++) {
    const p0 = mb.get(day(a[i - 1].t)), p1 = mb.get(day(a[i].t));
    if (p0 && p1) pairs.push([a[i].close / a[i - 1].close - 1, p1 / p0 - 1]);
  }
  const xs = pairs.slice(-n);
  if (xs.length < 15) return null;
  const mx = xs.reduce((s, p) => s + p[0], 0) / xs.length, my = xs.reduce((s, p) => s + p[1], 0) / xs.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of xs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? r2(sxy / Math.sqrt(sxx * syy)) : null;
}
