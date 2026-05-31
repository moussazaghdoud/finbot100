// Shared helpers for agents: the strict output schema + evidence formatting.
import { CONFIG } from '../config.js';

export const STANCES = ['bullish', 'bearish', 'neutral'];

// Coerce any agent output (LLM or mock) into the canonical, gradeable shape.
export function normalizeThesis(agent, raw, evidence) {
  const stance = STANCES.includes(raw?.stance) ? raw.stance : 'neutral';
  let confidence = Number(raw?.confidence);
  if (!Number.isFinite(confidence)) confidence = 55;
  confidence = Math.max(50, Math.min(90, Math.round(confidence))); // honest bounds
  return {
    agent,
    asset: CONFIG.asset,
    stance,
    confidence,
    thesis: String(raw?.thesis || '').trim() || '(no thesis)',
    catalyst: String(raw?.catalyst || '').trim() || '(unspecified)',
    keyRisk: String(raw?.keyRisk || '').trim() || '(unspecified)',
    horizonDays: CONFIG.horizonDays,
    evidenceRefs: Array.isArray(raw?.evidenceRefs) ? raw.evidenceRefs.slice(0, 4) : [],
  };
}

export function evidenceText(ev, news) {
  const lines = [
    `Asset: ${ev.asset} (${CONFIG.assetName})`,
    `Price: $${ev.price?.toLocaleString?.() ?? ev.price}`,
    `Return 3d: ${ev.ret3d}%  |  7d: ${ev.ret7d}%  |  30d: ${ev.ret30d}%`,
    `14d daily volatility: ${ev.volatility}%`,
    `Distance from 30d high: ${ev.pctFromHigh}%  |  above 30d low: ${ev.pctFromLow}%`,
  ];
  if (news?.length) {
    lines.push('Recent headlines (references):');
    news.forEach((n, i) => lines.push(`  [N${i + 1}] ${n.title}`));
  }
  return lines.join('\n');
}

// The contract every agent must satisfy, embedded in each system prompt.
export const OUTPUT_RULES = `Respond with ONLY a JSON object, no prose, with keys:
{
  "stance": "bullish" | "bearish" | "neutral",
  "confidence": integer 50-90 (a calibrated probability your directional call is right; do NOT exceed 90 — overconfidence is penalized),
  "thesis": "1-2 sentence claim",
  "catalyst": "what, in the next few days, would confirm or break this",
  "keyRisk": "the single thing that most threatens this thesis",
  "evidenceRefs": ["short references to the numbers/headlines you used, e.g. 'ret7d', 'N2'"]
}
Rules: every claim must rest on the evidence provided. Do not invent numbers. Be honest about uncertainty.`;
