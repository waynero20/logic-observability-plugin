import { writeFileSync } from 'fs';
import { join } from 'path';
import { BpmnModdle } from 'bpmn-moddle';
import { layoutProcess } from 'bpmn-auto-layout';
import { loadFlows, ensureOutputDir, type IRFlow, type IRNode } from './shared.js';

function irTypeToBpmn(type: string): string {
  switch (type) {
    case 'task': return 'bpmn:ServiceTask';
    case 'decision': return 'bpmn:ExclusiveGateway';
    case 'start': return 'bpmn:StartEvent';
    case 'end': return 'bpmn:EndEvent';
    case 'parallel_split':
    case 'parallel_join': return 'bpmn:ParallelGateway';
    default: return 'bpmn:ServiceTask';
  }
}

async function generateBPMN(flow: IRFlow): Promise<string> {
  const moddle = new BpmnModdle();

  const process = moddle.create('bpmn:Process', {
    id: `Process_${flow.flow.replace(/-/g, '_')}`,
    isExecutable: true,
  });

  // Create BPMN elements for each node
  const elementMap = new Map<string, any>();

  for (const node of flow.nodes) {
    const bpmnType = irTypeToBpmn(node.type);
    const element = moddle.create(bpmnType, {
      id: node.id,
      name: node.label,
    });
    elementMap.set(node.id, element);
    process.get('flowElements').push(element);
  }

  // Create sequence flows
  for (let i = 0; i < flow.edges.length; i++) {
    const edge = flow.edges[i];
    const sourceRef = elementMap.get(edge.from);
    const targetRef = elementMap.get(edge.to);

    if (!sourceRef || !targetRef) continue;

    const sequenceFlow = moddle.create('bpmn:SequenceFlow', {
      id: `flow_${i}`,
      name: edge.condition || undefined,
      sourceRef,
      targetRef,
    });
    process.get('flowElements').push(sequenceFlow);
  }

  const definitions = moddle.create('bpmn:Definitions', {
    id: 'Definitions_1',
    targetNamespace: 'http://geidi.com/logic-observability',
    rootElements: [process],
  });

  const { xml: xmlWithoutLayout } = await moddle.toXML(definitions, { format: true });

  // Add DI layout
  const xmlWithLayout = await layoutProcess(xmlWithoutLayout);
  return xmlWithLayout;
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

for (const flow of flows) {
  try {
    const bpmn = await generateBPMN(flow);
    writeFileSync(join(outputDir, `${flow.flow}.bpmn`), bpmn);
    console.log(`  ✓ ${flow.flow}.bpmn`);
  } catch (e) {
    console.error(`  ✗ ${flow.flow}.bpmn: ${(e as Error).message}`);
  }
}
