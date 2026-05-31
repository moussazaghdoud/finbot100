// `npm run debate` — run today's Analyst Council debate on BTC and log the calls.
import { CONFIG } from '../config.js';
import { fetchSeries, buildEvidence } from '../data/marketData.js';
import { fetchNews } from '../data/news.js';
import { runOracle } from '../agents/oracle.js';
import { runAtlas } from '../agents/atlas.js';
import { runModerator } from '../agents/moderator.js';
import { makePrediction, appendPredictions } from '../ledger/store.js';
import { llmMode } from '../agents/llm.js';
import { rule, c, stanceColor, dollars } from '../ui.js';

function printThesis(t) {
  const sc = stanceColor(t.stance);
  console.log(`\n${c.bold}${t.agent}${c.reset}  ${sc}${t.stance.toUpperCase()}${c.reset}  ${c.dim}confidence ${t.confidence}%${c.reset}`);
  console.log(`  ${t.thesis}`);
  console.log(`  ${c.dim}Catalyst:${c.reset} ${t.catalyst}`);
  console.log(`  ${c.dim}Key risk:${c.reset} ${t.keyRisk}`);
  console.log(`  ${c.dim}Evidence:${c.reset} ${t.evidenceRefs.join(', ') || '—'}`);
}

async function main() {
  console.log(rule('FINBOT 100 · ANALYST COUNCIL · BTC'));
  console.log(`${c.dim}Reasoning engine: ${llmMode()}${c.reset}`);

  const { series, source } = await fetchSeries();
  const ev = buildEvidence(series);
  const news = await fetchNews();
  console.log(`${c.dim}Data: ${source} · price ${dollars(ev.price)} · 7d ${ev.ret7d}% · vol ${ev.volatility}%/d · news items ${news.length}${c.reset}`);

  console.log(rule('THE DEBATE'));
  const oracle = await runOracle(ev, news);
  const atlas = await runAtlas(ev, news, oracle);
  printThesis(oracle);
  printThesis(atlas);

  const mod = await runModerator(oracle, atlas);
  console.log(rule('MODERATOR (neutral synthesis — not advice)'));
  const agColor = mod.agreement === 'disagree' ? c.magenta : mod.agreement === 'agree' ? c.cyan : c.yellow;
  console.log(`  ${agColor}${mod.agreement.toUpperCase()}${c.reset} — ${mod.summary}`);
  console.log(`  ${c.green}Bull case:${c.reset} ${mod.bullCase}`);
  console.log(`  ${c.red}Bear case:${c.reset} ${mod.bearCase}`);
  console.log(`  ${c.dim}Open question:${c.reset} ${mod.residualUncertainty}`);

  const preds = [makePrediction(oracle, ev.price), makePrediction(atlas, ev.price)];
  appendPredictions(preds);
  console.log(rule('LEDGER'));
  console.log(`  ${c.dim}2 falsifiable calls logged, resolving in ${CONFIG.horizonDays} days. Run ${c.reset}npm run grade${c.dim} after the horizon, then ${c.reset}npm run board${c.dim}.${c.reset}`);
  console.log('');
}

main().catch((e) => {
  console.error(`\n${c.red}Error:${c.reset} ${e.message}\n`);
  process.exit(1);
});
