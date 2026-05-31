// `npm run demo` — the whole spine end to end in one command:
// seed historical calls -> grade them -> show the scoreboard -> run a live debate.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const steps = ['seed.js', 'grade.js', 'board.js', 'debate.js'];

for (const step of steps) {
  const r = spawnSync(process.execPath, [join(here, step)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
