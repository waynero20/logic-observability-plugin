import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, type IRFlow, type IRNode, type IREdge } from './shared.js';

function generateSummary(flow: IRFlow): string {
  const nodeMap = new Map<string, IRNode>();
  for (const node of flow.nodes) nodeMap.set(node.id, node);

  // Walk the flow from entry_point following edges
  const visited = new Set<string>();
  const sentences: string[] = [];
  const queue = [flow.entry_point];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = nodeMap.get(current);
    if (!node) continue;

    const outEdges = flow.edges.filter(e => e.from === current);

    if (node.type === 'start') {
      sentences.push(`The ${flow.title} starts with "${node.label}".`);
    } else if (node.type === 'end') {
      sentences.push(`Finally, it reaches "${node.label}".`);
    } else if (node.type === 'decision') {
      if (outEdges.length >= 2) {
        const branches = outEdges
          .map(e => {
            const target = nodeMap.get(e.to);
            return `${e.condition || 'a path'} → ${target?.label || e.to}`;
          })
          .join(', or ');
        sentences.push(`When "${node.label}", it either ${branches}.`);
      } else {
        sentences.push(`It checks: "${node.label}".`);
      }
    } else if (node.type === 'task') {
      if (node.label !== '(merge)') {
        sentences.push(`It then "${node.label}".`);
      }
    }

    for (const edge of outEdges) {
      if (!visited.has(edge.to)) queue.push(edge.to);
    }
  }

  // Add metadata
  const aiNodes = flow.nodes.filter(n => n.logic_type === 'probabilistic');
  const configNodes = flow.nodes.filter(n => n.logic_type === 'configurable');

  let meta = '';
  if (aiNodes.length > 0) {
    meta += `\n\nThis flow includes ${aiNodes.length} AI-powered step(s): ${aiNodes.map(n => `"${n.label}"`).join(', ')}.`;
  }
  if (configNodes.length > 0) {
    meta += `\n\nConfig-driven step(s): ${configNodes.map(n => `"${n.label}"`).join(', ')}.`;
  }
  if (flow.error_modes && flow.error_modes.length > 0) {
    meta += `\n\nKnown error modes: ${flow.error_modes.join('; ')}.`;
  }

  // Confidence summary
  const runtimeEdges = flow.edges.filter(e => e.runtime?.observed);
  if (runtimeEdges.length > 0) {
    meta += `\n\nRuntime-verified paths: ${runtimeEdges.length}/${flow.edges.length}.`;
  }
  const staticOnly = flow.nodes.filter(n => n.confidence === 'static_only');
  const verified = flow.nodes.filter(n => n.confidence === 'static_plus_runtime');
  if (verified.length > 0 || staticOnly.length > 0) {
    meta += `\n\nConfidence: ${verified.length} runtime-verified, ${staticOnly.length} static-only step(s).`;
  }

  return `# ${flow.title}\n\n${sentences.join(' ')}${meta}\n`;
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

let combined = '';
for (const flow of flows) {
  const summary = generateSummary(flow);
  writeFileSync(join(outputDir, `${flow.flow}.summary.md`), summary);
  combined += summary + '\n---\n\n';
  console.log(`  ✓ ${flow.flow}.summary.md`);
}

writeFileSync(join(outputDir, 'all-flows-summary.md'), combined);
console.log(`  ✓ all-flows-summary.md (combined)`);
