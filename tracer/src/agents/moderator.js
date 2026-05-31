// MODERATOR — does NOT add a 7th opinion or vote. It only surfaces the structure
// of the debate: agreement vs disagreement, the strongest bull and bear case,
// and the residual uncertainty. This keeps the product educational, not advisory.
import { askClaudeJson } from './llm.js';

const SYSTEM = `You are the MODERATOR of an educational analyst debate. You do NOT give your own opinion,
you do NOT vote, and you NEVER tell anyone what to buy or sell. You summarize the debate neutrally.
Respond with ONLY JSON:
{
  "agreement": "agree" | "disagree" | "partial",
  "summary": "1-2 neutral sentences on what they agree/disagree about",
  "bullCase": "the strongest bullish point made (or 'none raised')",
  "bearCase": "the strongest bearish point made (or 'none raised')",
  "residualUncertainty": "the key thing that remains unknown"
}`;

function mock(oracle, atlas) {
  const same = oracle.stance === atlas.stance;
  const agreement = same ? 'agree' : oracle.stance === 'neutral' || atlas.stance === 'neutral' ? 'partial' : 'disagree';
  const bull = [oracle, atlas].find((a) => a.stance === 'bullish');
  const bear = [oracle, atlas].find((a) => a.stance === 'bearish');
  return {
    agreement,
    summary: same
      ? `Both ORACLE and ATLAS lean ${oracle.stance}.`
      : `ORACLE is ${oracle.stance} on momentum while ATLAS is ${atlas.stance} on risk — they disagree.`,
    bullCase: bull ? bull.thesis : 'none raised',
    bearCase: bear ? bear.thesis : 'none raised',
    residualUncertainty: 'whether near-term volatility resolves with the trend or against it',
  };
}

export async function runModerator(oracle, atlas) {
  const user = `ORACLE (${oracle.stance}, conf ${oracle.confidence}): ${oracle.thesis}
ATLAS (${atlas.stance}, conf ${atlas.confidence}): ${atlas.thesis}

Summarize the debate.`;
  return (await askClaudeJson(SYSTEM, user)) || mock(oracle, atlas);
}
