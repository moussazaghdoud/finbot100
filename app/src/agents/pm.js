// The Portfolio Manager: one Claude call per cycle that sees every asset's
// decision together with the fund, and may VETO trades (turn BUY/SELL into
// HOLD) for portfolio reasons — concentration, correlated bets, cash, weak
// conviction. It can never create a trade the per-asset councils didn't call.
import { askClaudeJson } from './llm.js';

const SYS = `You are the Portfolio Manager of a virtual paper-trading fund. Per-asset councils have each decided BUY, SELL or HOLD for the next few days. You see all decisions together with the current portfolio.

Your only power is to VETO a BUY or SELL (turn it into HOLD) for portfolio-level reasons, for example:
- several BUYs on assets that move together (e.g. multiple cryptos, or chip stocks) — keep the strongest, veto the rest;
- a BUY that would over-concentrate the fund (max 22% per asset) or leave too little cash;
- a low-conviction trade that contradicts the rest of the portfolio's view.
You cannot create new trades or change a HOLD. If the trades look sensible together, veto nothing. Be sparing: veto only with a concrete reason.

Respond with ONLY this JSON: {"vetoes":[{"asset":"TICKER","reason":"one sentence"}],"summary":"1-2 sentences on the portfolio as a whole"}`;

export async function runPortfolioManager({ fund, signals }) {
  const trades = signals.filter((s) => s.action !== 'HOLD');
  if (!trades.length) return null;
  const lines = [
    `Fund: total €${fund.total.toFixed(2)}, cash €${fund.cash.toFixed(2)} (${((fund.cash / fund.total) * 100).toFixed(0)}%).`,
    'Holdings: ' + (fund.holdings.length ? fund.holdings.map((h) => `${h.asset} ${((h.value / fund.total) * 100).toFixed(0)}% (P&L ${h.pnlPct.toFixed(1)}%)`).join(', ') : 'none (all cash)'),
    '',
    'Council decisions this cycle:',
    ...signals.map((s) => `${s.asset} (${s.sector}): ${s.action}, conviction ${s.strength} — ${String(s.reason || '').slice(0, 220)}`),
  ];
  const out = await askClaudeJson(SYS, lines.join('\n'));
  if (!out) return null;
  const allowed = new Set(trades.map((s) => s.asset));
  const vetoes = (Array.isArray(out.vetoes) ? out.vetoes : [])
    .map((v) => ({ asset: String(v.asset || '').toUpperCase(), reason: String(v.reason || '').trim() }))
    .filter((v) => allowed.has(v.asset));
  return { vetoes, summary: String(out.summary || '').trim() };
}
