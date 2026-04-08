import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, layoutNodes, getNodeColor, type IRFlow } from './shared.js';

function generateXYFlow(flow: IRFlow): string {
  const positioned = layoutNodes(flow.nodes, flow.edges);

  const nodes = positioned.map(node => {
    const nodeType = node.type === 'task' ? 'taskNode'
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type) ? 'gatewayNode'
      : 'eventNode';

    return {
      id: node.id,
      type: nodeType,
      position: node.position,
      data: {
        label: node.label,
        nodeType: node.type,
        logicType: node.logic_type || null,
        codeRef: node.code_ref || null,
        description: node.description || null,
        calls: node.calls || [],
        spanName: node.span_name || null,
        decisionPoint: node.decision_point || null,
        reasonCodes: node.reason_codes || [],
        color: getNodeColor(node.logic_type),
      },
    };
  });

  const edges = flow.edges.map((edge, i) => ({
    id: `e-${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    label: edge.condition || undefined,
    animated: false,
  }));

  return JSON.stringify({ nodes, edges }, null, 2);
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

const allFlows: Record<string, any> = {};

for (const flow of flows) {
  const xyflowData = generateXYFlow(flow);
  allFlows[flow.flow] = JSON.parse(xyflowData);
  writeFileSync(join(outputDir, `${flow.flow}.xyflow.json`), xyflowData);
  console.log(`  ✓ ${flow.flow}.xyflow.json`);
}

// Also write a combined file
writeFileSync(join(outputDir, 'flows.xyflow.json'), JSON.stringify(allFlows, null, 2));
console.log(`  ✓ flows.xyflow.json (combined)`);
