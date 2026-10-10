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
