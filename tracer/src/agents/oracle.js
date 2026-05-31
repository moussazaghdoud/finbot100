// ORACLE — momentum / price-action analyst. Fast, probabilistic, short horizon.
import { askClaudeJson } from './llm.js';
import { normalizeThesis, evidenceText, OUTPUT_RULES } from './shared.js';

const SYSTEM = `You are ORACLE, a momentum and price-action market analyst on an educational platform.
You weight recent trend, momentum and position relative to recent highs/lows. You are fast and probabilistic.
You issue a falsifiable directional THESIS for the next few days — never investment advice, never "you should".
${OUTPUT_RULES}`;

function mock(ev) {
  const m = ev.ret7d ?? 0;
  let stance = 'neutral';
  let confidence = 55;
  if (m > 2) {
    stance = 'bullish';
    confidence = Math.min(85, 58 + Math.round(Math.abs(m)));
  } else if (m < -2) {
    stance = 'bearish';
    confidence = Math.min(85, 58 + Math.round(Math.abs(m)));
  }
  const dir = stance === 'bullish' ? 'upward' : stance === 'bearish' ? 'downward' : 'sideways';
  return {
    stance,
    confidence,
    thesis: `7d momentum is ${ev.ret7d}% and 3d is ${ev.ret3d}%, sitting ${ev.pctFromHigh}% from the 30d high — momentum points ${dir} into the next ${3} days.`,
    catalyst: stance === 'bullish' ? 'a push through the 30d high confirms continuation' : stance === 'bearish' ? 'a break below recent support extends the slide' : 'a decisive break of the recent range',
    keyRisk: `volatility is ${ev.volatility}%/day; a sharp reversal would invalidate the trend read`,
    evidenceRefs: ['ret7d', 'ret3d', 'pctFromHigh'],
  };
}

export async function runOracle(ev, news, { forceMock = false } = {}) {
  const raw =
    (!forceMock &&
      (await askClaudeJson(SYSTEM, `Evidence:\n${evidenceText(ev, news)}\n\nGive your thesis.`))) ||
    mock(ev);
  return normalizeThesis('ORACLE', raw, ev);
}
