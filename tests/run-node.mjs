// Ejecuta los mismos tests desde la terminal:  node tests/run-node.mjs
import { readFileSync } from 'node:fs';
import { runAll } from './tests.js';

const csv = readFileSync(new URL('./workout_data.csv', import.meta.url), 'utf8');
const res = await runAll(csv);
let g = '';
for (const r of res) {
  if (r.group !== g) { g = r.group; console.log('\n' + g); }
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  → ' + r.error}`);
}
const fail = res.filter((r) => !r.ok).length;
console.log(`\n${res.length - fail}/${res.length} correctos`);
process.exit(fail ? 1 : 0);
