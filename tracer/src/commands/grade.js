// `npm run grade` — resolve every due prediction against real BTC price.
import { fetchSeries, closeNearest } from '../data/marketData.js';
import { loadPredictions, savePredictions } from '../ledger/store.js';
import { gradePrediction } from '../ledger/grade.js';
import { c, rule, stanceColor } from '../ui.js';

async function main() {
  console.log(rule('FINBOT 100 · GRADE DUE PREDICTIONS'));
  const preds = loadPredictions();
  if (!preds.length) {
    console.log(`  ${c.yellow}No predictions yet. Run ${c.reset}npm run debate${c.yellow} or ${c.reset}npm run seed${c.yellow} first.${c.reset}\n`);
    return;
  }
  const { series } = await fetchSeries();
  const last = series[series.length - 1];
  const now = Date.now();

  let graded = 0;
  const updated = preds.map((p) => {
    if (p.resolved) return p;
    const g = gradePrediction(p, series, last.close, Math.max(now, last.t), closeNearest);
    if (!g) return p;
    graded += 1;
    const mark = g.correct ? `${c.green}✓ HIT ${c.reset}` : `${c.red}✗ MISS${c.reset}`;
    const sc = stanceColor(g.stance);
    console.log(`  ${mark} ${g.agent.padEnd(6)} ${sc}${g.stance.padEnd(7)}${c.reset} ` +
      `conf ${String(g.confidence).padStart(2)}% · move ${g.actualReturn > 0 ? '+' : ''}${g.actualReturn}% · brier ${g.brier}`);
    return g;
  });

  savePredictions(updated);
  console.log(`\n  ${graded ? c.green : c.yellow}${graded}${c.reset} prediction(s) graded. Run ${c.reset}npm run board${c.dim} to see the scoreboard.${c.reset}\n`);
}

main().catch((e) => {
  console.error(`\n${c.red}Error:${c.reset} ${e.message}\n`);
  process.exit(1);
});
