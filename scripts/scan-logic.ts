import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';
import { scanProject, type ScanResult, type ScanItem } from './extractors/function-scanner.js';

// ─── CLI argument parsing ───

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

const targetDir = positional[0];
const jsonMode = flags.includes('--json');
const checkMode = flags.includes('--check');

if (!targetDir) {
  console.error('Usage: tsx scripts/scan-logic.ts <target-directory> [--json] [--check]');
  process.exit(1);
}

const resolvedDir = resolve(targetDir);
if (!existsSync(resolvedDir)) {
  console.error(`Directory not found: ${resolvedDir}`);
  process.exit(1);
}

// ─── Load existing IR files for --check mode and alreadyDocumented ───

function loadExistingIR(projectRoot: string): Map<string, string> {
  const irMap = new Map<string, string>();
  const flowsDir = join(projectRoot, 'docs', 'flows');

  if (!existsSync(flowsDir)) return irMap;

  const files = readdirSync(flowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    try {
      const content = readFileSync(join(flowsDir, file), 'utf-8');
      const ir = yaml.load(content) as Record<string, any>;
      if (ir?.flow) {
        irMap.set(ir.flow, file);
      }
      // Also index by code_ref from nodes
      if (ir?.nodes) {
        for (const node of ir.nodes) {
          if (node.code_ref) {
            irMap.set(node.code_ref, file);
          }
        }
      }
    } catch {
      // Skip unparseable files
    }
  }

  return irMap;
}

// ─── Detect project type ───

function detectProjectType(dir: string): 'typescript' | 'dart' | 'python' | 'go' | 'unknown' {
  if (existsSync(join(dir, 'tsconfig.json')) || existsSync(join(dir, 'package.json'))) return 'typescript';
  if (existsSync(join(dir, 'pubspec.yaml'))) return 'dart';
  if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'setup.py')) || existsSync(join(dir, 'requirements.txt'))) return 'python';
  if (existsSync(join(dir, 'go.mod'))) return 'go';
  return 'unknown';
}

// ─── Pretty output ───

function printCategory(label: string, items: ScanItem[], defaultAction: string): void {
  if (items.length === 0) return;
  console.log(`\n### ${label} (${items.length}) — default: ${defaultAction}`);
  console.log('  #  | Function                          | File:Line                              | Branches | Extract?');
  console.log('-----|-----------------------------------|----------------------------------------|----------|----------');
  for (const item of items) {
    const name = item.name.padEnd(33).slice(0, 33);
    const file = item.filePath.padEnd(38).slice(0, 38);
    const branches = String(item.branchCount).padStart(6);
    const extract = item.recommended ? '  Yes' : '  Skip';
    console.log(`  ${String(item.id).padStart(2)} | ${name} | ${file} | ${branches}   | ${extract}`);
  }
}

function printSummary(result: ScanResult): void {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`Logic Scan Results`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Project type: ${result.projectType}`);
  console.log(`Files scanned: ${result.totalFiles}`);
  console.log(`Functions found: ${result.totalFunctions}`);

  const cats = result.categories;
  printCategory('ENTRY POINTS', cats.entryPoints, 'Include');
  printCategory('AI CALLS', cats.aiCalls, 'Include');
  printCategory('DATA MUTATIONS', cats.dataMutations, 'Include');
  printCategory('DECISION TREES', cats.decisionTrees, 'Include');
  printCategory('EXTERNAL CALLS', cats.externalCalls, 'Include');
  printCategory('UTILITIES', cats.utilities, 'Skip');
  printCategory('ALREADY DOCUMENTED', cats.alreadyDocumented, 'Skip');

  const documented = cats.alreadyDocumented.length;
  console.log(`\n───────────────────────────────────────`);
  console.log(`Summary: ${result.totalFunctions} found, ${result.recommended} recommended, ${result.skipped} skipped, ${documented} already documented`);
  console.log(`───────────────────────────────────────\n`);
}

// ─── Check mode ───

function runCheckMode(result: ScanResult, projectRoot: string): void {
  const flowsDir = join(projectRoot, 'docs', 'flows');
  if (!existsSync(flowsDir)) {
    console.log('No docs/flows/ directory found. No IR files exist yet.');
    return;
  }

  const files = readdirSync(flowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const irFlows: Array<{ file: string; flow: string; status: string; codeRefs: string[] }> = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(flowsDir, file), 'utf-8');
      const ir = yaml.load(content) as Record<string, any>;
      const codeRefs = (ir.nodes || [])
        .filter((n: any) => n.code_ref)
        .map((n: any) => n.code_ref);
      irFlows.push({ file, flow: ir.flow || file, status: ir.status || 'unknown', codeRefs });
    } catch {
      console.warn(`  Skipping unparseable: ${file}`);
    }
  }

  // Check for stale references
  const allFunctionRefs = new Set<string>();
  for (const cat of Object.values(result.categories)) {
    for (const item of cat) {
      allFunctionRefs.add(item.filePath);
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Coverage Check`);
  console.log(`═══════════════════════════════════════`);

  let staleCount = 0;
  let verifiedCount = 0;
  let draftCount = 0;

  for (const ir of irFlows) {
    const staleRefs = ir.codeRefs.filter(ref => !allFunctionRefs.has(ref));
    if (staleRefs.length > 0) {
      console.log(`  ⚠ STALE: ${ir.file} — code not found at: ${staleRefs.join(', ')}`);
      staleCount++;
    }
    if (ir.status === 'verified') verifiedCount++;
    else if (ir.status === 'draft') draftCount++;
  }

  const totalWithIR = result.categories.alreadyDocumented.length;
  const totalRecommended = result.recommended;
  const coverage = totalRecommended + totalWithIR > 0
    ? Math.round((totalWithIR / (totalRecommended + totalWithIR)) * 100)
    : 0;

  console.log(`\nDocumented: ${totalWithIR} functions`);
  console.log(`Undocumented (recommended): ${totalRecommended} functions`);
  console.log(`Draft IR files: ${draftCount}`);
  console.log(`Verified IR files: ${verifiedCount}`);
  console.log(`Stale IR files: ${staleCount}`);
  console.log(`Coverage: ${coverage}%\n`);
}

// ─── Main ───

const projectType = detectProjectType(resolvedDir);

if (projectType !== 'typescript') {
  if (jsonMode) {
    console.log(JSON.stringify({
      projectType,
      totalFiles: 0,
      totalFunctions: 0,
      categories: {
        entryPoints: [], decisionTrees: [], aiCalls: [],
        externalCalls: [], dataMutations: [], utilities: [],
        alreadyDocumented: [],
      },
      recommended: 0,
      skipped: 0,
      message: `Project type "${projectType}" detected. Automated scanning not available — use conversational mode.`,
    }, null, 2));
  } else {
    console.log(`Project type: ${projectType}`);
    console.log(`Automated scanning is only available for TypeScript projects.`);
    console.log(`For ${projectType} projects, use conversational mode in Claude Code.`);
  }
  process.exit(0);
}

const existingIR = loadExistingIR(process.cwd());
const result = scanProject(resolvedDir, existingIR);

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
} else if (checkMode) {
  printSummary(result);
  runCheckMode(result, process.cwd());
} else {
  printSummary(result);
  console.log('Review the list above. Tell me which items to remove or add,');
  console.log('then run /extract-logic to generate IR for the approved items.');
}
