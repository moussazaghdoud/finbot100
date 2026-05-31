import { CONFIG } from '../config.js';

export const STANCES = ['bullish', 'bearish', 'neutral'];

export function normalizeThesis(agent, raw) {
  const stance = STANCES.includes(raw?.stance) ? raw.stance : 'neutral';
  let confidence = Number(raw?.confidence);
  if (!Number.isFinite(confidence)) confidence = 55;
  confidence = Math.max(50, Math.min(90, Math.round(confidence)));
  return {
    agent,
    stance,
    confidence,
    thesis: String(raw?.thesis || '').trim() || '(no thesis)',
    catalyst: String(raw?.catalyst || '').trim() || '(unspecified)',
    keyRisk: String(raw?.keyRisk || '').trim() || '(unspecified)',
    horizonDays: CONFIG.horizonDays,
    evidenceRefs: Array.isArray(raw?.evidenceRefs) ? raw.evidenceRefs.slice(0, 4) : [],
  };
}

export function evidenceText(ev, ctx) {
  const L = [
    `Asset: ${ev.asset} (${ev.name}), sector ${ev.sector}`,
    `Price: ${ev.price}`,
    `Returns — 3d ${ev.ret3d}% | 7d ${ev.ret7d}% | 30d ${ev.ret30d}%`,
    `14d daily volatility: ${ev.volatility}%`,
    `From 30d high: ${ev.pctFromHigh}% | above 30d low: ${ev.pctFromLow}%`,
  ];
  if (ctx?.macro) L.push(`Macro: market 30d ${ctx.macro.market30d}%, gold 30d ${ctx.macro.gold30d}%, regime ${ctx.macro.regime}`);
  if (ctx?.sentiment != null) L.push(`News sentiment: ${ctx.sentiment} (-1..+1)`);
  if (ctx?.news?.length) {
    L.push('Headlines (references):');
    ctx.news.forEach((n, i) => L.push(`  [N${i + 1}] ${n.title}`));
  }
  return L.join('\n');
}

export const OUTPUT_RULES = `Respond with ONLY a JSON object (no prose):
{
 "stance":"bullish"|"bearish"|"neutral",
 "confidence":50-90 (calibrated probability your call is right; >90 is penalized),
 "thesis":"1-2 sentences",
 "catalyst":"what in the next few days confirms/breaks it",
 "keyRisk":"the single biggest threat to this view",
 "evidenceRefs":["which numbers/headlines you used"]
}
Ground every claim in the evidence. Invent nothing. This is educational analysis, never advice — never say "you should".`;
