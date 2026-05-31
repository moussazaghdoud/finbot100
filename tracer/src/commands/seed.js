// `npm run seed` — backfill the ledger with REAL, historical, already-resolvable
// calls so you can see the full grade->calibration loop immediately (instead of
// waiting 3 real days). Uses actual past BTC prices; agents reason (mock) on the
// evidence as it stood on each past day. Honest, not fabricated.
import { fetchSeries, buildEvidence } from '../data/marketData.js';
import { runOracle } from '../agents/oracle.js';
import { runAtlas } from '../agents/atlas.js';
import { makePrediction, appendPredictions, savePredictions } from '../ledger/store.js';
import { c, rule } from '../ui.js';

async function main() {
  console.log(rule('FINBOT 100 · SEED HISTORICAL CALLS'));
  savePredictions([]); // start clean so the demo is reproducible
  const { series, source } = await fetchSeries();
  console.log(`${c.dim}Data: ${source}, ${series.length} daily bars${c.reset}`);

  const newPreds = [];
  // For each past day whose 3-day horizon has already elapsed, make a call.
  for (let i = series.length - 11; i <= series.length - 4; i++) {
    if (i < 7) continue;
    const ev = buildEvidence(series, i);
    const createdAt = series[i].t;
    const oracle = await runOracle(ev, [], { forceMock: true });
    const atlas = await runAtlas(ev, [], oracle, { forceMock: true });
    newPreds.push(makePrediction(oracle, ev.price, createdAt));
    newPreds.push(makePrediction(atlas, ev.price, createdAt));
  }
  appendPredictions(newPreds);
  console.log(`  ${c.green}Seeded ${newPreds.length} historical calls${c.reset} across the last ~10 days.`);
  console.log(`  ${c.dim}Now run ${c.reset}npm run grade${c.dim} then ${c.reset}npm run board${c.dim}.${c.reset}\n`);
}

main().catch((e) => {
  console.error(`\n${c.red}Error:${c.reset} ${e.message}\n`);
  process.exit(1);
});
