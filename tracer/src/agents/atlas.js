// ATLAS — risk manager. Structurally the skeptic. Its mandate is to find the
// strongest counter-case and flag volatility / drawdown / overextension risk.
import { askClaudeJson } from './llm.js';
import { normalizeThesis, evidenceText, OUTPUT_RULES } from './shared.js';

const SYSTEM = `You are ATLAS, a risk manager on an educational platform. You are the careful, skeptical voice.
Your job is NOT to predict gains — it is to assess risk and articulate the strongest counter-thesis.
You weight volatility, overextension (distance from highs/lows), and drawdown potential.
You issue a falsifiable risk-oriented THESIS for the next few days — never investment advice, never "you should".
${OUTPUT_RULES}`;

function mock(ev) {
  const vol = ev.volatility ?? 0;
  const nearHigh = (ev.pctFromHigh ?? -100) > -3; // within 3% of 30d high = overextended
  const nearLow = (ev.pctFromLow ?? 100) < 3;

  let stance = 'neutral';
  let confidence = 55;
  if (vol > 3 || nearHigh) {
    stance = 'bearish'; // elevated risk of a pullback
    confidence = Math.min(80, 56 + Math.round(vol) + (nearHigh ? 6 : 0));
  } else if (nearLow && vol < 2) {
    stance = 'bullish'; // washed out, low vol — downside risk limited
    confidence = 60;
  }
  return {
    stance,
    confidence,
    thesis:
      stance === 'bearish'
        ? `Risk is elevated: ${vol}%/day volatility${nearHigh ? ` with price only ${ev.pctFromHigh}% below the 30d high (overextended)` : ''} — the asymmetry favours a pullback.`
        : stance === 'bullish'
          ? `Downside looks limited: price is ${ev.pctFromLow}% above the 30d low with subdued ${vol}%/day volatility.`
          : `Risk is balanced: ${vol}%/day volatility, ${ev.pctFromHigh}% from the high — no clear asymmetry.`,
    catalyst: 'a volatility spike or failure to hold recent levels would confirm the risk',
    keyRisk: 'the counter-case breaks if volatility compresses and trend simply continues',
    evidenceRefs: ['volatility', 'pctFromHigh', 'pctFromLow'],
  };
}

export async function runAtlas(ev, news, oracleThesis, { forceMock = false } = {}) {
  const counter = oracleThesis
    ? `\nORACLE just argued: "${oracleThesis.thesis}" (stance: ${oracleThesis.stance}). Pressure-test it.`
    : '';
  const raw =
    (!forceMock &&
      (await askClaudeJson(
        SYSTEM,
        `Evidence:\n${evidenceText(ev, news)}${counter}\n\nGive your risk thesis.`
      ))) ||
    mock(ev);
  return normalizeThesis('ATLAS', raw, ev);
}
