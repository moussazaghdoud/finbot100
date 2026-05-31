// `npm run board` — the Accountability Ledger scoreboard. The product's spine:
// not "who made money" but "whose reasoning was right, and how calibrated."
import { loadPredictions } from '../ledger/store.js';
import { calibrationByAgent } from '../ledger/calibration.js';
import { c, rule } from '../ui.js';

function brierLabel(b) {
  if (b == null) return '';
  if (b <= 0.18) return `${c.green}good${c.reset}`;
  if (b <= 0.25) return `${c.yellow}fair${c.reset}`;
  return `${c.red}poor${c.reset}`;
}
function gapLabel(g) {
  if (g == null) return '';
  const a = Math.abs(g);
  if (a <= 6) return `${c.green}well-calibrated${c.reset}`;
  if (g > 0) return `${c.red}overconfident${c.reset}`;
  return `${c.cyan}underconfident${c.reset}`;
}

function main() {
  console.log(rule('FINBOT 100 · ACCOUNTABILITY LEDGER'));
  const preds = loadPredictions();
  const rows = calibrationByAgent(preds);
  const pending = preds.filter((p) => !p.resolved).length;

  if (!rows.length) {
    console.log(`  ${c.yellow}No graded predictions yet.${c.reset} (${pending} pending)\n`);
    return;
  }

  for (const r of rows) {
    console.log(`\n  ${c.bold}${r.agent}${c.reset}  ${c.dim}(${r.n} graded calls)${c.reset}`);
    console.log(`    Hit rate:        ${c.bold}${r.hitRate}%${c.reset}`);
    console.log(`    Avg confidence:  ${r.avgConfidence}%`);
    console.log(`    Calibration gap: ${r.calibrationGap > 0 ? '+' : ''}${r.calibrationGap} pts  ${gapLabel(r.calibrationGap)}`);
    console.log(`    Brier score:     ${r.avgBrier}  ${brierLabel(r.avgBrier)} ${c.dim}(0 = perfect, lower better)${c.reset}`);
  }

  console.log(`\n  ${c.dim}${pending} prediction(s) still pending.${c.reset}`);
  console.log(`  ${c.dim}Calibration gap = stated confidence − realized hit-rate. ~0 means the agent's confidence is honest.${c.reset}\n`);
}

main();
