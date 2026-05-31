// Real BTC market data. Primary: Binance public klines (keyless).
// Fallback: CoinGecko keyless market_chart. Returns a daily-close series
// plus a computed "evidence pack" the agents reason over.

const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchBinanceDaily(limit = 31) {
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const rows = await res.json();
  // kline: [openTime, open, high, low, close, volume, closeTime, ...]
  return rows.map((r) => ({ t: r[0], close: Number(r[4]), high: Number(r[2]), low: Number(r[3]) }));
}

async function fetchCoinGeckoDaily(days = 30) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = await res.json();
  return json.prices.map(([t, close]) => ({ t, close, high: close, low: close }));
}

export async function fetchSeries() {
  try {
    return { series: await fetchBinanceDaily(), source: 'Binance' };
  } catch (e1) {
    try {
      return { series: await fetchCoinGeckoDaily(), source: 'CoinGecko' };
    } catch (e2) {
      throw new Error(
        `Could not fetch BTC data (Binance: ${e1.message}; CoinGecko: ${e2.message}). Check your internet connection.`
      );
    }
  }
}

function pct(a, b) {
  return ((a - b) / b) * 100;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// Build an evidence pack from a series, evaluated "as of" the given index
// (defaults to the latest bar). Letting callers pick an index lets us build
// honest, backdated evidence for the seed/demo command using real history.
export function buildEvidence(series, asOfIndex = series.length - 1) {
  const s = series.slice(0, asOfIndex + 1);
  const cur = s[s.length - 1];
  const at = (daysAgo) => s[s.length - 1 - daysAgo]?.close ?? null;

  const close = cur.close;
  const c3 = at(3);
  const c7 = at(7);
  const c30 = at(30) ?? s[0].close;

  const closes = s.map((x) => x.close);
  const highs = s.slice(-30).map((x) => x.high ?? x.close);
  const lows = s.slice(-30).map((x) => x.low ?? x.close);
  const high30 = Math.max(...highs);
  const low30 = Math.min(...lows);

  const dailyReturns = [];
  for (let i = 1; i < s.length; i++) dailyReturns.push(pct(s[i].close, s[i - 1].close));
  const vol = stdev(dailyReturns.slice(-14)); // 14d daily-return volatility

  return {
    asset: 'BTC',
    asOf: cur.t,
    price: close,
    ret3d: c3 != null ? +pct(close, c3).toFixed(2) : null,
    ret7d: c7 != null ? +pct(close, c7).toFixed(2) : null,
    ret30d: c30 != null ? +pct(close, c30).toFixed(2) : null,
    volatility: +vol.toFixed(2),
    high30,
    low30,
    pctFromHigh: +pct(close, high30).toFixed(2), // negative = below high
    pctFromLow: +pct(close, low30).toFixed(2), // positive = above low
    series: s.map((x) => ({ t: x.t, close: x.close })),
  };
}

export function closeNearest(series, tsMs) {
  let best = series[0];
  let bestDist = Infinity;
  for (const p of series) {
    const d = Math.abs(p.t - tsMs);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return { close: best.close, t: best.t, withinDay: bestDist <= DAY_MS };
}
