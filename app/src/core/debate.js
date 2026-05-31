// Run the full Analyst Council debate for one asset, log falsifiable calls,
// and cache the brief (debates are shared across users — compute once).
import { CONFIG, assetById } from '../config.js';
import { fetchSeries, buildEvidence } from '../data/market.js';
import { getContext, ctxForAsset } from './context.js';
import { runSage, runOracle, runScout, runSentinel, runAtlas, runAlchemist } from '../agents/council.js';
import { runModerator } from '../agents/moderator.js';
import { COUNCIL_ORDER } from '../agents/registry.js';
import { makePrediction, appendPredictions, loadPredictions } from '../ledger/store.js';

const cache = new Map(); // asset -> { brief, ts }

export async function runDebate(asset, { log = true } = {}) {
  const cached = cache.get(asset);
  if (cached && Date.now() - cached.ts < CONFIG.debateCacheMin * 60000) return cached.brief;

  const meta = assetById(asset);
  const { series, source } = await fetchSeries(asset);
  const ev = buildEvidence(meta, series);
  const shared = await getContext();
  const ctx = ctxForAsset(asset, shared);

  // Round 1: independent theses (SAGE, ORACLE, SCOUT, SENTINEL, ATLAS).
  const [sage, oracle, scout, sentinel, atlas] = await Promise.all([
    runSage(ev, ctx),
    runOracle(ev, ctx),
    runScout(ev, ctx),
    runSentinel(ev, ctx),
    runAtlas(ev, ctx),
  ]);
  // Round 2: ALCHEMIST synthesizes the council into a portfolio-fit view.
  const partial = [sage, oracle, scout, sentinel, atlas];
  const alchemist = await runAlchemist(ev, { ...ctx, council: partial });

  const byId = { SAGE: sage, ORACLE: oracle, SCOUT: scout, SENTINEL: sentinel, ATLAS: atlas, ALCHEMIST: alchemist };
  const theses = COUNCIL_ORDER.map((id) => byId[id]);

  const moderator = await runModerator(theses);

  if (log) {
    // Log each agent's call to the ledger (deduped per asset per day).
    const existing = loadPredictions();
    const today = new Date().toDateString();
    const already = new Set(
      existing
        .filter((p) => p.source === 'agent' && p.asset === asset && new Date(p.createdAt).toDateString() === today)
        .map((p) => p.agent)
    );
    const fresh = theses.filter((t) => !already.has(t.agent)).map((t) => makePrediction(t, asset, ev.price, 'agent'));
    if (fresh.length) appendPredictions(fresh);
  }

  const brief = {
    asset,
    name: meta.name,
    sector: meta.sector,
    source,
    price: ev.price,
    evidence: {
      ret3d: ev.ret3d,
      ret7d: ev.ret7d,
      ret30d: ev.ret30d,
      volatility: ev.volatility,
      pctFromHigh: ev.pctFromHigh,
      pctFromLow: ev.pctFromLow,
    },
    macro: shared.macro,
    geo: shared.geo,
    sentiment: ctx.sentiment,
    news: (ctx.news || []).slice(0, 5),
    theses,
    moderator,
    series: ev.series,
    horizonDays: CONFIG.horizonDays,
    ts: Date.now(),
  };
  cache.set(asset, { brief, ts: Date.now() });
  return brief;
}
