// The six analysts. Each: a Claude-backed reasoner with a transparent,
// data-driven mock fallback so the council always runs. Every output obeys the
// same gradeable contract (see shared.js).
import { askClaudeJson } from './llm.js';
import { normalizeThesis, evidenceText, OUTPUT_RULES } from './shared.js';

const clamp = (n, lo = 50, hi = 88) => Math.max(lo, Math.min(hi, Math.round(n)));
const isRiskAsset = (ev) => ev.sector === 'Crypto' || ev.sector === 'Technology' || ev.sector === 'Semiconductors' || ev.sector === 'Autos';

let FORCE_MOCK = false;
export const setForceMock = (v) => (FORCE_MOCK = v);

async function run(agent, system, user, mock) {
  const ai = !FORCE_MOCK && (await askClaudeJson(system, user));
  return { ...normalizeThesis(agent, ai || mock), via: ai ? 'claude' : 'rules' };
}

// ── SAGE — macro economist ────────────────────────────────────────────────
const SAGE_SYS = `You are SAGE, a measured macro economist on an educational platform. You weight the macro regime
(rates, risk-on/off, gold) and the long arc over short-term noise. ${OUTPUT_RULES}`;
function sageMock(ev, ctx) {
  const m = ctx.macro || { regime: 'neutral', market30d: 0, gold30d: 0 };
  const risk = isRiskAsset(ev);
  let stance = 'neutral',
    conf = 55;
  if (m.regime === 'risk-on') {
    stance = risk ? 'bullish' : ev.sector === 'Commodities' ? 'neutral' : 'bullish';
    conf = clamp(60 + Math.abs(m.market30d) / 2);
  } else if (m.regime === 'risk-off') {
    stance = ev.sector === 'Commodities' ? 'bullish' : risk ? 'bearish' : 'neutral';
    conf = clamp(60 + Math.abs(m.market30d) / 2);
  }
  return {
    stance,
    confidence: conf,
    thesis: `Macro regime reads ${m.regime} (broad market 30d ${m.market30d}%, gold ${m.gold30d}%). For a ${ev.sector} asset that tilts the medium-term backdrop ${stance}.`,
    catalyst: 'a shift in the risk-on/off regime or a rates surprise',
    keyRisk: 'macro regimes turn slowly — a sharp asset-specific move can override the backdrop short-term',
    evidenceRefs: ['macro.regime', 'ret30d'],
  };
}
export const runSage = (ev, ctx) =>
  run('SAGE', SAGE_SYS, `Evidence:\n${evidenceText(ev, ctx)}\n\nGive your macro thesis.`, sageMock(ev, ctx));

// ── ORACLE — momentum ─────────────────────────────────────────────────────
const ORACLE_SYS = `You are ORACLE, a momentum and price-action analyst. Fast, probabilistic, short horizon. ${OUTPUT_RULES}`;
function oracleMock(ev) {
  const m = ev.ret7d ?? 0;
  let stance = 'neutral',
    conf = 55;
  if (m > 2) (stance = 'bullish'), (conf = clamp(58 + Math.abs(m)));
  else if (m < -2) (stance = 'bearish'), (conf = clamp(58 + Math.abs(m)));
  const dir = stance === 'bullish' ? 'upward' : stance === 'bearish' ? 'downward' : 'sideways';
  return {
    stance,
    confidence: conf,
    thesis: `7d momentum ${ev.ret7d}% and 3d ${ev.ret3d}%, ${ev.pctFromHigh}% from the 30d high — the tape points ${dir}.`,
    catalyst: stance === 'bearish' ? 'a break of recent support extends the move' : 'a push through the 30d high confirms continuation',
    keyRisk: `${ev.volatility}%/day volatility means a sharp reversal can flip this fast`,
    evidenceRefs: ['ret7d', 'ret3d', 'pctFromHigh'],
  };
}
export const runOracle = (ev, ctx) =>
  run('ORACLE', ORACLE_SYS, `Evidence:\n${evidenceText(ev, ctx)}\n\nGive your momentum thesis.`, oracleMock(ev));

// ── SCOUT — news intelligence ─────────────────────────────────────────────
const SCOUT_SYS = `You are SCOUT, a news-intelligence analyst. You weigh the prevailing narrative in recent headlines. ${OUTPUT_RULES}`;
function scoutMock(ev, ctx) {
  const s = ctx.sentiment ?? 0;
  let stance = 'neutral',
    conf = 54;
  if (s > 0.15) (stance = 'bullish'), (conf = clamp(56 + s * 30));
  else if (s < -0.15) (stance = 'bearish'), (conf = clamp(56 + Math.abs(s) * 30));
  return {
    stance,
    confidence: conf,
    thesis: `Headline tone scores ${s} on a -1..+1 scale; the prevailing narrative around ${ev.name} leans ${stance}.`,
    catalyst: 'a major headline or scheduled release shifting the narrative',
    keyRisk: 'news sentiment is noisy and can reverse on a single print',
    evidenceRefs: ['sentiment', ctx.news?.[0] ? 'N1' : ''].filter(Boolean),
  };
}
export const runScout = (ev, ctx) =>
  run('SCOUT', SCOUT_SYS, `Evidence:\n${evidenceText(ev, ctx)}\n\nGive your news thesis.`, scoutMock(ev, ctx));

// ── SENTINEL — geopolitics ────────────────────────────────────────────────
const SENT_SYS = `You are SENTINEL, a geopolitics analyst. You watch conflict, policy and the price of fear (gold, volatility).
You mostly flag scenario risk and are comfortable saying "neutral". ${OUTPUT_RULES}`;
function sentinelMock(ev, ctx) {
  const g = ctx.geo || { score: 0, flag: false };
  const risk = isRiskAsset(ev);
  let stance = 'neutral',
    conf = 53;
  if (g.flag) {
    stance = ev.sector === 'Commodities' ? 'bullish' : risk ? 'bearish' : 'neutral';
    conf = clamp(58 + g.score * 20);
  }
  return {
    stance,
    confidence: conf,
    thesis: g.flag
      ? `Geopolitical risk is elevated (signal ${g.score}); that historically pressures ${ev.sector} risk assets and supports safe havens.`
      : `No acute geopolitical catalyst detected; ${ev.name} should trade on its own fundamentals near-term.`,
    catalyst: 'an escalation, sanction, or policy headline',
    keyRisk: 'geopolitical shocks are by nature unpredictable in timing',
    evidenceRefs: ['geo.score'],
  };
}
export const runSentinel = (ev, ctx) =>
  run('SENTINEL', SENT_SYS, `Evidence:\n${evidenceText(ev, ctx)}\n\nGive your geopolitical thesis.`, sentinelMock(ev, ctx));

// ── ATLAS — risk manager (the skeptic) ────────────────────────────────────
const ATLAS_SYS = `You are ATLAS, a risk manager and the council's skeptic. Your job is the strongest counter-thesis:
volatility, overextension, drawdown asymmetry. ${OUTPUT_RULES}`;
function atlasMock(ev) {
  const vol = ev.volatility ?? 0;
  const nearHigh = (ev.pctFromHigh ?? -100) > -3;
  const nearLow = (ev.pctFromLow ?? 100) < 3;
  let stance = 'neutral',
    conf = 55;
  if (vol > 3 || nearHigh) (stance = 'bearish'), (conf = clamp(56 + vol + (nearHigh ? 6 : 0)));
  else if (nearLow && vol < 2) (stance = 'bullish'), (conf = 60);
  return {
    stance,
    confidence: conf,
    thesis:
      stance === 'bearish'
        ? `Risk is elevated: ${vol}%/day volatility${nearHigh ? `, only ${ev.pctFromHigh}% below the 30d high (overextended)` : ''} — asymmetry favours a pullback.`
        : stance === 'bullish'
          ? `Downside looks contained: ${ev.pctFromLow}% above the 30d low with subdued ${vol}%/day volatility.`
          : `Risk is balanced: ${vol}%/day vol, ${ev.pctFromHigh}% from the high — no clear asymmetry.`,
    catalyst: 'a volatility spike or failure to hold recent levels',
    keyRisk: 'the counter-case fails if volatility compresses and trend simply continues',
    evidenceRefs: ['volatility', 'pctFromHigh', 'pctFromLow'],
  };
}
export const runAtlas = (ev, ctx) =>
  run('ATLAS', ATLAS_SYS, `Evidence:\n${evidenceText(ev, ctx)}\n\nGive your risk thesis.`, atlasMock(ev));

// ── ALCHEMIST — portfolio optimizer ───────────────────────────────────────
const ALCH_SYS = `You are ALCHEMIST, a portfolio optimizer. You synthesize the council's views into a balance/fit
judgement for a diversified educational portfolio — never an order. ${OUTPUT_RULES}`;
function alchemistMock(ev, ctx) {
  const council = ctx.council || [];
  const score = council.reduce((s, t) => s + (t.stance === 'bullish' ? 1 : t.stance === 'bearish' ? -1 : 0), 0);
  let stance = 'neutral',
    conf = 54;
  if (score >= 2) (stance = 'bullish'), (conf = clamp(55 + score * 4));
  else if (score <= -2) (stance = 'bearish'), (conf = clamp(55 + Math.abs(score) * 4));
  return {
    stance,
    confidence: conf,
    thesis: `Council net lean is ${score > 0 ? '+' : ''}${score}. For portfolio fit, ${ev.name} looks ${stance === 'neutral' ? 'a diversifier rather than a conviction position' : `a ${stance} tilt that ${stance === 'bullish' ? 'adds' : 'reduces'} risk-asset exposure`}.`,
    catalyst: 'a clearer council consensus or a change in correlation regime',
    keyRisk: 'consensus can be crowded — agreement is not the same as being right',
    evidenceRefs: ['council.consensus'],
  };
}
export const runAlchemist = (ev, ctx) =>
  run('ALCHEMIST', ALCH_SYS, `Evidence:\n${evidenceText(ev, ctx)}\nCouncil so far: ${(ctx.council || []).map((t) => `${t.agent}:${t.stance}`).join(', ')}\n\nGive your portfolio thesis.`, alchemistMock(ev, ctx));

// ── Rules-only council (no Claude) — used when Claude is off, fails or is capped.
export function rulesCouncil(ev, ctx) {
  const partial = [
    ['SAGE', sageMock(ev, ctx)], ['ORACLE', oracleMock(ev)], ['SCOUT', scoutMock(ev, ctx)],
    ['SENTINEL', sentinelMock(ev, ctx)], ['ATLAS', atlasMock(ev)],
  ].map(([a, m]) => ({ ...normalizeThesis(a, m), via: 'rules' }));
  const alch = { ...normalizeThesis('ALCHEMIST', alchemistMock(ev, { ...ctx, council: partial })), via: 'rules' };
  return [...partial, alch];
}

// ── The Claude council: ONE call per asset. Six lenses + a chair's decision,
// all grounded in the asset's dossier (see core/dossier.js).
const COUNCIL_SYS = (h) => `You are the FinBot Council: six analysts and a chair who decide BUY, SELL or HOLD for one asset over the next ${h} days, for a virtual paper-trading fund. You receive a dossier of real, current data.

Each analyst gives an independent view through their own lens — they may disagree:
- SAGE (macro economist): interest rates, yield curve, dollar, VIX, risk regime, and how this asset typically reacts to them.
- ORACLE (momentum & technicals): trend, moving averages, RSI, MACD, volume, recent price action.
- SCOUT (news): what the asset-specific headlines actually say, whether they matter and whether they are already priced in. Ignore irrelevant or promotional headlines (e.g. fund filings).
- SENTINEL (geopolitics & policy): conflicts, sanctions, tariffs, regulation, central banks, elections — from the headlines and macro.
- ATLAS (risk manager, the skeptic): volatility, overextension, distance from highs, earnings or events inside the horizon, correlation with weak related assets. Argue the strongest counter-case.
- ALCHEMIST (fundamentals & relative value): valuation, growth and analyst targets for stocks; for crypto, Fear & Greed and how it is moving versus its related assets.
Then the CHAIR weighs the six views and decides.

Rules:
- Ground every claim in the dossier's numbers or headlines (cite them, e.g. "RSI 72", "[N3]"). Invent nothing. If something is missing, say so.
- Analyst confidence 50-90 = calibrated probability the stance is right over the horizon (bullish = price up more than 0.5%, bearish = down more than 0.5%, neutral = within ±1.5%).
- The chair chooses BUY only with a clear edge, SELL when the downside case is clearly stronger (SELL means exit if held — no short selling), otherwise HOLD. Weak or mixed evidence means HOLD. An earnings date or major scheduled event inside the horizon raises the bar.
- Conviction 0-100 = strength of the chair's decision (50 = marginal, 80+ = strong).

Respond with ONLY this JSON, no prose before or after:
{"analysts":[{"agent":"SAGE","stance":"bullish|bearish|neutral","confidence":50,"thesis":"1-2 sentences citing the data","catalyst":"what would confirm it","keyRisk":"what would break it"}, ...one object for each of SAGE, ORACLE, SCOUT, SENTINEL, ATLAS, ALCHEMIST in that order],
 "decision":{"action":"BUY|SELL|HOLD","conviction":0,"reasoning":"2-3 sentences: why this action now","keyDrivers":["short phrase","short phrase"],"risks":"the main risk to this decision","changeMind":"what would make the council reverse"},
 "summary":{"agreement":"agree|partial|disagree","bullCase":"strongest bull point","bearCase":"strongest bear point"}}`;

const ORDER = ['SAGE', 'ORACLE', 'SCOUT', 'SENTINEL', 'ATLAS', 'ALCHEMIST'];
const ACTIONS = ['BUY', 'SELL', 'HOLD'];

export async function runCouncilClaude(dossierText, horizonDays) {
  const out = await askClaudeJson(COUNCIL_SYS(horizonDays), `DOSSIER\n\n${dossierText}\n\nDeliberate and decide.`);
  if (!out || !Array.isArray(out.analysts)) return null;
  const byAgent = Object.fromEntries(out.analysts.map((a) => [String(a.agent || '').toUpperCase(), a]));
  if (!ORDER.every((a) => byAgent[a])) return null;
  const d = out.decision || {};
  const action = String(d.action || '').toUpperCase();
  if (!ACTIONS.includes(action)) return null;
  const theses = ORDER.map((a) => ({ ...normalizeThesis(a, byAgent[a]), via: 'claude' }));
  const s = out.summary || {};
  return {
    theses,
    decision: {
      action,
      conviction: Math.max(0, Math.min(100, Math.round(Number(d.conviction) || 0))),
      reasoning: String(d.reasoning || '').trim(),
      keyDrivers: Array.isArray(d.keyDrivers) ? d.keyDrivers.slice(0, 5).map(String) : [],
      risks: String(d.risks || '').trim(),
      changeMind: String(d.changeMind || '').trim(),
    },
    summary: { agreement: ['agree', 'partial', 'disagree'].includes(s.agreement) ? s.agreement : 'partial', bullCase: String(s.bullCase || 'none raised'), bearCase: String(s.bearCase || 'none raised') },
  };
}
