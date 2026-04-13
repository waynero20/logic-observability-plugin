import { execSync } from 'child_process';
import { join } from 'path';

// ─── Ensure required dependencies are installed ───

const REQUIRED_DEPS = ['@dagrejs/dagre', 'bpmn-moddle', 'bpmn-auto-layout', 'js-yaml'];

function checkAndInstallDeps(): void {
  const missing: string[] = [];
  for (const dep of REQUIRED_DEPS) {
    try {
      // Use resolve-style check — try importing the package
      execSync(`node -e "require.resolve('${dep}')"`, { stdio: 'ignore', cwd: process.cwd() });
    } catch {
      missing.push(dep);
    }
  }
  if (missing.length > 0) {
    console.log(`Installing missing dependencies: ${missing.join(', ')}...`);
    execSync(`npm i -D ${missing.join(' ')}`, { stdio: 'inherit', cwd: process.cwd() });
    console.log('Dependencies installed.\n');
  }
}

checkAndInstallDeps();

// ─── Run generators ───

const generators = ['xyflow', 'bpmn', 'xml', 'html', 'svg', 'summary', 'context', 'element-map'];

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
