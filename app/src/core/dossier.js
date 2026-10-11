// The dossier: everything the bot knows about one asset, gathered once per
// debate — price action, technical indicators, related assets, macro, news
// about this asset, and company fundamentals. Claude reads its text form.
import { CONFIG, assetById } from '../config.js';
import { fetchSeries, buildEvidence } from '../data/market.js';
import { technicals, correlationByDate } from '../data/technicals.js';
import { getMacro } from '../data/macro.js';
import { assetNews, sentiment } from '../data/news.js';
import { getFundamentals } from '../data/fundamentals.js';

const chg = (s, d) => (s.length > d ? +(((s[s.length - 1].close - s[s.length - 1 - d].close) / s[s.length - 1 - d].close) * 100).toFixed(2) : null);

export async function buildDossier(assetId) {
  const meta = assetById(assetId);
  const { series, source } = await fetchSeries(assetId);
  const ev = buildEvidence(meta, series);
  const health = {};

  const [macro, news, fundamentals, peers] = await Promise.all([
    getMacro(),
    assetNews(meta).then((n) => { health.news = n.length ? 'ok' : 'none found'; return n; }).catch((e) => { health.news = e.message; return []; }),
    getFundamentals(meta)
      .then((f) => { health.fundamentals = f ? 'ok' : meta.kind === 'stock' && !['SPY', 'GLD'].includes(meta.id) ? 'no FMP_API_KEY' : 'n/a'; return f; })
      .catch((e) => { health.fundamentals = e.message; return null; }),
    Promise.all((CONFIG.peers[assetId] || []).map(async (pid) => {
      try {
        const ps = (await fetchSeries(pid)).series;
        return { id: pid, name: assetById(pid)?.name || pid, change5d: chg(ps, 5), change30d: chg(ps, 21), corr60d: correlationByDate(series, ps, 60) };
      } catch {
        return null;
      }
    })).then((ps) => ps.filter(Boolean)),
  ]);
  health.peers = `${peers.length}/${(CONFIG.peers[assetId] || []).length}`;
  health.macro = macro.health;

  return { meta, source, ev, tech: technicals(series), peers, macro, news, sentiment: sentiment(news), fundamentals, health };
}

const line = (label, v) => (v == null || v === '' ? null : `${label}: ${v}`);
const fmt = (n, unit = '') => (n == null ? 'n/a' : `${n}${unit}`);

export function dossierText(d) {
  const { meta, ev, tech, peers, macro, news, fundamentals: f } = d;
  const L = [];
  L.push(`ASSET: ${meta.name} (${meta.id}) — ${meta.kind === 'crypto' ? 'cryptocurrency, trades 24/7' : `US-listed ${meta.sector}`}`);
  L.push(`Today: ${new Date().toISOString().slice(0, 10)}. Decision horizon: ${CONFIG.horizonDays} days.`);
  L.push('', 'PRICE ACTION');
  L.push(`Price $${ev.price} · 3d ${fmt(ev.ret3d, '%')} · 7d ${fmt(ev.ret7d, '%')} · 30d ${fmt(ev.ret30d, '%')} · daily volatility (14d) ${fmt(ev.volatility, '%')}`);
  L.push(`From 30d high ${fmt(ev.pctFromHigh, '%')} · above 30d low ${fmt(ev.pctFromLow, '%')} · from 52-week high ${fmt(tech.from52wHigh, '%')} · above 52-week low ${fmt(tech.from52wLow, '%')}`);
  L.push('', 'TECHNICALS');
  L.push(`RSI(14) ${fmt(tech.rsi14)} (above 70 overbought, below 30 oversold) · price vs 20d avg ${fmt(tech.vsSma20, '%')}, vs 50d ${fmt(tech.vsSma50, '%')}, vs 200d ${fmt(tech.vsSma200, '%')}`);
  L.push(`Trend: ${tech.trend} · MACD histogram ${fmt(tech.macdHistPct, '% of price')} (positive = upward momentum building)` + (tech.volume5dVs20d ? ` · volume last 5d vs 20d avg: ${tech.volume5dVs20d}x` : ''));
  if (peers.length) {
    L.push('', 'RELATED ASSETS (5d / 30d change, 60-day correlation with this asset)');
    for (const p of peers) L.push(`${p.name} (${p.id}): ${fmt(p.change5d, '%')} / ${fmt(p.change30d, '%')}, correlation ${fmt(p.corr60d)}`);
  }
  L.push('', 'MACRO');
  const m = macro;
  L.push([
    m.rates && `US 10y yield ${m.rates.us10y}% (5d change ${m.rates.us10yChange5d} pts), 2y ${m.rates.us2y}%, 10y-2y curve ${m.rates.curve10y2y}`,
    m.vix && `VIX ${m.vix.level} (5d ${fmt(m.vix.change5d, '%')}; above 25 = fear)`,
    m.eurusd && `EUR/USD ${m.eurusd.rate} (higher = weaker dollar)`,
  ].filter(Boolean).join(' · ') || 'unavailable');
  L.push([
    m.sp500 && `S&P 500 5d ${fmt(m.sp500.change5d, '%')} / 30d ${fmt(m.sp500.change30d, '%')}`,
    m.nasdaq100 && `Nasdaq 100 5d ${fmt(m.nasdaq100.change5d, '%')} / 30d ${fmt(m.nasdaq100.change30d, '%')}`,
    m.gold && `gold 30d ${fmt(m.gold.change30d, '%')}`,
    m.oil && `oil 30d ${fmt(m.oil.change30d, '%')}`,
    `regime ${m.regime}`,
  ].filter(Boolean).join(' · '));
  if (meta.kind === 'crypto' && m.cryptoFearGreed) L.push(`Crypto Fear & Greed: ${m.cryptoFearGreed.value} (${m.cryptoFearGreed.label}), a week ago ${fmt(m.cryptoFearGreed.weekAgo)}`);
  if (f) {
    L.push('', 'FUNDAMENTALS');
    L.push([
      line('market cap $bn', f.marketCapB), line('P/E (TTM)', f.peTTM), line('PEG', f.pegTTM), line('price/sales', f.priceToSalesTTM),
      line('net margin %', f.netMarginPct), line('debt/equity', f.debtToEquity), line('revenue growth %', f.revenueGrowthPct), line('EPS growth %', f.epsGrowthPct), line('beta', f.beta),
    ].filter(Boolean).join(' · '));
    if (f.analystTarget) L.push(`Analyst price target: consensus $${f.analystTarget} (low $${fmt(f.analystTargetLow)}, high $${fmt(f.analystTargetHigh)}) vs price $${ev.price}`);
    if (f.nextEarnings) L.push(`NEXT EARNINGS: ${f.nextEarnings.date} (EPS estimate ${fmt(f.nextEarnings.epsEstimate)})`);
    if (f.lastEarnings) L.push(`Last earnings ${f.lastEarnings.date}: EPS ${f.lastEarnings.epsActual} vs estimate ${f.lastEarnings.epsEstimate}`);
  }
  L.push('', `NEWS ABOUT ${meta.name.toUpperCase()} (last 72h)`);
  if (news.length) news.forEach((n, i) => L.push(`[N${i + 1}] ${new Date(n.date).toISOString().slice(0, 16).replace('T', ' ')} — ${n.title}`));
  else L.push('No asset-specific headlines found.');
  return L.join('\n');
}
