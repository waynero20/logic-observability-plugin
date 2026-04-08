import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, type IRFlow } from './shared.js';

interface ElementMap {
  forward: Record<string, { flowId: string; nodeId: string; label: string; type: string }>;
  reverse: Record<string, Array<{ spanOrDecision: string; type: 'span' | 'decision_point' }>>;
}

function generateElementMap(flows: IRFlow[]): ElementMap | null {
  const forward: ElementMap['forward'] = {};
  const reverse: ElementMap['reverse'] = {};
  let hasEntries = false;

  for (const flow of flows) {
    for (const node of flow.nodes) {
      const spanName = node.span_name;
      const decisionPoint = node.decision_point;

      if (spanName) {
        hasEntries = true;
        forward[`span:${spanName}`] = {
          flowId: flow.flow,
          nodeId: node.id,
          label: node.label,
          type: 'span',
        };

        const key = `${flow.flow}:${node.id}`;
        if (!reverse[key]) reverse[key] = [];
        reverse[key].push({ spanOrDecision: spanName, type: 'span' });
      }

      if (decisionPoint) {
        hasEntries = true;
        forward[`decision:${decisionPoint}`] = {
          flowId: flow.flow,
          nodeId: node.id,
          label: node.label,
          type: 'decision_point',
        };

        const key = `${flow.flow}:${node.id}`;
        if (!reverse[key]) reverse[key] = [];
        reverse[key].push({ spanOrDecision: decisionPoint, type: 'decision_point' });
      }
    }
  }

  return hasEntries ? { forward, reverse } : null;
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

const elementMap = generateElementMap(flows);

if (elementMap) {
  writeFileSync(join(outputDir, 'element-map.json'), JSON.stringify(elementMap, null, 2));
  console.log(`  ✓ element-map.json (${Object.keys(elementMap.forward).length} entries)`);
} else {
  console.log('  ⊘ No span_name or decision_point fields found — skipping element map');
}
