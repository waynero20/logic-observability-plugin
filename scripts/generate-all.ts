import { execSync } from 'child_process';
import { join } from 'path';

const generators = ['xyflow', 'bpmn', 'html', 'svg', 'summary', 'element-map'];
const scriptDir = join(import.meta.dirname || '.', 'generators');

let failed = 0;

for (const gen of generators) {
  console.log(`\nGenerating ${gen}...`);
  try {
    execSync(`npx tsx scripts/generators/ir-to-${gen}.ts`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    console.error(`  ✗ ${gen} failed`);
    failed++;
  }
}

console.log(`\nDone. ${failed === 0 ? 'All outputs' : `${generators.length - failed}/${generators.length} outputs`} in docs/flows/generated/`);
if (failed > 0) process.exit(1);
