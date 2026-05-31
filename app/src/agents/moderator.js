// MODERATOR — neutral synthesis. No vote, no opinion, never advice.
import { askClaudeJson } from './llm.js';

const SYS = `You are the MODERATOR of an educational analyst debate. You never give your own opinion, never vote,
never tell anyone what to buy or sell. Summarize neutrally. Respond ONLY JSON:
{"agreement":"agree"|"disagree"|"partial","summary":"1-2 neutral sentences","bullCase":"strongest bull point or 'none raised'","bearCase":"strongest bear point or 'none raised'","residualUncertainty":"the key open question"}`;

function tally(theses) {
  const b = theses.filter((t) => t.stance === 'bullish').length;
  const r = theses.filter((t) => t.stance === 'bearish').length;
  return { b, r };
}

function mock(theses) {
  const { b, r } = tally(theses);
  const agreement = b && r ? 'disagree' : b || r ? (b + r >= theses.length - 1 ? 'agree' : 'partial') : 'partial';
  const bull = theses.filter((t) => t.stance === 'bullish').sort((a, c) => c.confidence - a.confidence)[0];
  const bear = theses.filter((t) => t.stance === 'bearish').sort((a, c) => c.confidence - a.confidence)[0];
  return {
    agreement,
    summary: `${b} of ${theses.length} analysts lean bullish, ${r} bearish. ${b && r ? 'The council is split.' : b ? 'The council tilts bullish.' : r ? 'The council tilts bearish.' : 'The council is cautious/neutral.'}`,
    bullCase: bull ? `${bull.agent}: ${bull.thesis}` : 'none raised',
    bearCase: bear ? `${bear.agent}: ${bear.thesis}` : 'none raised',
    residualUncertainty: 'whether near-term price action resolves with or against the prevailing view',
  };
}

export async function runModerator(theses) {
  const user = theses.map((t) => `${t.agent} (${t.stance}, ${t.confidence}%): ${t.thesis}`).join('\n') + '\n\nSummarize the debate.';
  const out = (await askClaudeJson(SYS, user)) || mock(theses);
  return { ...out, tally: tally(theses) };
}
