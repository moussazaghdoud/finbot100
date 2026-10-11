// Run the Analyst Council for one asset: build its dossier, let Claude's council
// (one call) deliberate and decide — or the built-in rules if Claude is off or
// fails — log every call to the ledger, and cache the brief.
import { CONFIG, assetById } from '../config.js';
import { buildDossier, dossierText } from './dossier.js';
import { runCouncilClaude, rulesCouncil } from '../agents/council.js';
import { mockModerator, tally } from '../agents/moderator.js';
import { makePrediction, appendPredictions, loadPredictions } from '../ledger/store.js';

const cache = new Map(); // asset -> { brief, ts }
const GEO = /(war|sanction|tariff|conflict|attack|missile|invasion|election|coup|embargo|strike|geopolit)/i;

export function getCachedBrief(asset) {
  const c = cache.get(asset);
  return c && Date.now() - c.ts < CONFIG.debateCacheMin * 60000 ? c.brief : null;
}

// Context in the shape the rule-based analysts expect, derived from the dossier.
function rulesCtx(d) {
  const market30d = d.macro.sp500?.change30d ?? 0;
  const gold30d = d.macro.gold?.change30d ?? 0;
  const geoScore = d.news.length ? d.news.filter((n) => GEO.test(n.title)).length / d.news.length : 0;
  const geo = { score: +(geoScore + (gold30d > 2 ? 0.15 : 0)).toFixed(2), flag: geoScore + (gold30d > 2 ? 0.15 : 0) >= 0.3 };
  return { macro: { market30d, gold30d, regime: d.macro.regime }, geo, news: d.news, sentiment: d.sentiment };
}

export async function runDebate(asset, { log = true, force = false } = {}) {
  const cached = cache.get(asset);
  if (!force && cached && Date.now() - cached.ts < CONFIG.debateCacheMin * 60000) return cached.brief;

  const meta = assetById(asset);
  const d = await buildDossier(asset);
  const ev = d.ev;
  const text = dossierText(d);

  let theses, moderator, decision = null;
  const ai = await runCouncilClaude(text, CONFIG.horizonDays);
  if (ai) {
    theses = ai.theses;
    decision = ai.decision;
    moderator = {
      agreement: ai.summary.agreement,
      summary: decision.reasoning,
      bullCase: ai.summary.bullCase,
      bearCase: ai.summary.bearCase,
      residualUncertainty: decision.changeMind || 'n/a',
      tally: tally(theses),
    };
  } else {
    theses = rulesCouncil(ev, rulesCtx(d));
    moderator = { ...mockModerator(theses), tally: tally(theses) };
  }

  if (log) {
    // Log each analyst's call — and the council's decision as agent "BOT" — to
    // the ledger, deduped per asset per day.
    const existing = loadPredictions();
    const today = new Date().toDateString();
    const already = new Set(
      existing
        .filter((p) => p.source === 'agent' && p.asset === asset && new Date(p.createdAt).toDateString() === today)
        .map((p) => p.agent)
    );
    const calls = [...theses];
    if (decision) {
      calls.push({
        agent: 'BOT',
        stance: decision.action === 'BUY' ? 'bullish' : decision.action === 'SELL' ? 'bearish' : 'neutral',
        confidence: Math.max(50, Math.min(90, decision.conviction)),
        thesis: `${decision.action}: ${decision.reasoning}`,
      });
    }
    const fresh = calls.filter((t) => !already.has(t.agent)).map((t) => makePrediction(t, asset, ev.price, 'agent'));
    if (fresh.length) appendPredictions(fresh);
  }

  const brief = {
    asset,
    name: meta.name,
    sector: meta.sector,
    source: d.source,
    price: ev.price,
    evidence: {
      ret3d: ev.ret3d,
      ret7d: ev.ret7d,
      ret30d: ev.ret30d,
      volatility: ev.volatility,
      pctFromHigh: ev.pctFromHigh,
      pctFromLow: ev.pctFromLow,
    },
    macro: d.macro,
    sentiment: d.sentiment,
    news: d.news,
    dossier: { tech: d.tech, peers: d.peers, fundamentals: d.fundamentals, health: d.health, text },
    theses,
    decision,
    via: ai ? 'claude' : 'rules',
    moderator,
    series: ev.series,
    horizonDays: CONFIG.horizonDays,
    ts: Date.now(),
  };
  cache.set(asset, { brief, ts: Date.now() });
  return brief;
}
