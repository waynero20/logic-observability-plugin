import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, type IRFlow, type IRNode, type IREdge } from './shared.js';

function generateContext(flows: IRFlow[]): string {
  const sections: string[] = [];

  sections.push('# System Logic Context');
  sections.push('');
  sections.push('This document describes the business logic flows of the system.');
  sections.push('Use it to understand what the system does, how decisions are made,');
  sections.push('and where AI/config-driven behaviour exists.');
  sections.push('');
  sections.push(`Total flows: ${flows.length}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push('');

  for (const flow of flows) {
    sections.push(`## ${flow.title}`);
    sections.push('');
    sections.push(`**Service:** ${flow.service || 'unknown'} | **Module:** ${flow.module || 'unknown'} | **Status:** ${flow.status}`);
    sections.push('');
    sections.push(flow.description || '');
    sections.push('');

    // Node summary
    sections.push('### Steps');
    sections.push('');

    const nodeMap = new Map<string, IRNode>();
    for (const node of flow.nodes) nodeMap.set(node.id, node);

    // Walk from entry point
    const visited = new Set<string>();
    const queue = [flow.entry_point];
    const ordered: IRNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = nodeMap.get(current);
      if (!node) continue;
      ordered.push(node);

      const outEdges = flow.edges.filter(e => e.from === current);
      for (const edge of outEdges) {
        if (!visited.has(edge.to)) queue.push(edge.to);
      }
    }

    for (const node of ordered) {
      if (node.label === '(merge)') continue;

      const confidence = node.confidence ? ` [${node.confidence}]` : '';
      const logicTag = node.logic_type ? ` (${node.logic_type})` : '';

      if (node.type === 'start') {
        sections.push(`- **START** ${node.label}${confidence}`);
      } else if (node.type === 'end') {
        sections.push(`- **END** ${node.label}${confidence}`);
      } else if (node.type === 'decision') {
        const outEdges = flow.edges.filter(e => e.from === node.id);
        const branches = outEdges.map(e => {
          const target = nodeMap.get(e.to);
          return `${e.condition || '?'} -> ${target?.label || e.to}`;
        }).join('; ');
        sections.push(`- **DECISION** ${node.label}${logicTag}${confidence}: ${branches}`);
      } else {
        sections.push(`- ${node.label}${logicTag}${confidence}`);
        if (node.calls && node.calls.length > 0) {
          sections.push(`  - Calls: ${node.calls.join(', ')}`);
        }
      }
    }

    // Runtime data summary if any edges have it
    const runtimeEdges = flow.edges.filter(e => e.runtime?.observed);
    if (runtimeEdges.length > 0) {
      sections.push('');
      sections.push('### Runtime Evidence');
      sections.push('');
      for (const edge of runtimeEdges) {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        const parts: string[] = [];
        if (edge.runtime!.frequency !== undefined) parts.push(`freq: ${(edge.runtime!.frequency! * 100).toFixed(0)}%`);
        if (edge.runtime!.error_rate !== undefined) parts.push(`errors: ${(edge.runtime!.error_rate! * 100).toFixed(1)}%`);
        if (edge.runtime!.avg_latency_ms !== undefined) parts.push(`latency: ${edge.runtime!.avg_latency_ms}ms`);
        sections.push(`- ${fromNode?.label || edge.from} -> ${toNode?.label || edge.to}: ${parts.join(', ')}`);
      }
    }

    // Error modes
    if (flow.error_modes && flow.error_modes.length > 0) {
      sections.push('');
      sections.push('### Known Error Modes');
      sections.push('');
      for (const mode of flow.error_modes) {
        sections.push(`- ${mode}`);
      }
    }

    sections.push('');
    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

const context = generateContext(flows);
writeFileSync(join(outputDir, 'ai-context.md'), context);
console.log(`  ✓ ai-context.md (${flows.length} flows)`);
