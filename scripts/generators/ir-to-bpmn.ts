import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, type IRFlow } from './shared.js';
import dagre from '@dagrejs/dagre';

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

function sanitizeId(id: string): string {
  // BPMN IDs must start with a letter or underscore
  return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function generateBPMN(flow: IRFlow): string {
  // ─── Layout with dagre (LR) ───
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 200, nodesep: 100 });

  for (const node of flow.nodes) {
    const dims = node.type === 'task'
      ? { width: 200, height: 80 }
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type)
        ? { width: 50, height: 50 }
        : { width: 36, height: 36 };
    g.setNode(node.id, dims);
  }
  for (const edge of flow.edges) {
    g.setEdge(edge.from, edge.to);
  }
  dagre.layout(g);

  const processId = `Process_${sanitizeId(flow.flow)}`;
  const collaborationId = `Collaboration_${sanitizeId(flow.flow)}`;
  const participantId = `Participant_${sanitizeId(flow.flow)}`;

  // Build incoming/outgoing maps
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  flow.edges.forEach((edge, i) => {
    const flowId = `Flow_${i}`;
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from)!.push(flowId);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to)!.push(flowId);
  });

  // ─── Build XML manually for full control ───
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
  lines.push('  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"');
  lines.push('  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"');
  lines.push('  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
  lines.push(`  id="Definitions_1" targetNamespace="http://geidi.com/logic-observability">`);

  // Process
  lines.push(`  <bpmn:process id="${processId}" name="${escapeXml(flow.title)}" isExecutable="true">`);

  for (const node of flow.nodes) {
    const bpmnType = irTypeToBpmn(node.type);
    const tag = bpmnType.replace('bpmn:', '');
    const nodeId = sanitizeId(node.id);
    const inRefs = incoming.get(node.id) || [];
    const outRefs = outgoing.get(node.id) || [];

    lines.push(`    <bpmn:${tag} id="${nodeId}" name="${escapeXml(node.label)}">`);
    for (const ref of inRefs) lines.push(`      <bpmn:incoming>${ref}</bpmn:incoming>`);
    for (const ref of outRefs) lines.push(`      <bpmn:outgoing>${ref}</bpmn:outgoing>`);
    lines.push(`    </bpmn:${tag}>`);
  }

  // Sequence flows
  flow.edges.forEach((edge, i) => {
    const flowId = `Flow_${i}`;
    const nameAttr = edge.condition ? ` name="${escapeXml(edge.condition)}"` : '';
    lines.push(`    <bpmn:sequenceFlow id="${flowId}" sourceRef="${sanitizeId(edge.from)}" targetRef="${sanitizeId(edge.to)}"${nameAttr}/>`);
  });

  lines.push('  </bpmn:process>');

  // ─── Diagram Interchange (DI) — required by Camunda ───
  lines.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_1">`);
  lines.push(`    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">`);

  // Node shapes
  for (const node of flow.nodes) {
    const pos = g.node(node.id);
    const nodeId = sanitizeId(node.id);
    const x = Math.round(pos.x - pos.width / 2);
    const y = Math.round(pos.y - pos.height / 2);

    lines.push(`      <bpmndi:BPMNShape id="${nodeId}_di" bpmnElement="${nodeId}">`);
    lines.push(`        <dc:Bounds x="${x}" y="${y}" width="${pos.width}" height="${pos.height}"/>`);
    lines.push(`      </bpmndi:BPMNShape>`);
  }

  // Edge shapes with waypoints
  flow.edges.forEach((edge, i) => {
    const flowId = `Flow_${i}`;
    const fromPos = g.node(edge.from);
    const toPos = g.node(edge.to);

    // Source: right side of node, Target: left side of node
    const fromX = Math.round(fromPos.x + fromPos.width / 2);
    const fromY = Math.round(fromPos.y);
    const toX = Math.round(toPos.x - toPos.width / 2);
    const toY = Math.round(toPos.y);

    lines.push(`      <bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">`);
    lines.push(`        <di:waypoint x="${fromX}" y="${fromY}"/>`);
    // Add midpoint if not a straight line
    if (fromY !== toY) {
      const midX = Math.round((fromX + toX) / 2);
      lines.push(`        <di:waypoint x="${midX}" y="${fromY}"/>`);
      lines.push(`        <di:waypoint x="${midX}" y="${toY}"/>`);
    }
    lines.push(`        <di:waypoint x="${toX}" y="${toY}"/>`);
    lines.push(`      </bpmndi:BPMNEdge>`);
  });

  lines.push('    </bpmndi:BPMNPlane>');
  lines.push('  </bpmndi:BPMNDiagram>');
  lines.push('</bpmn:definitions>');

  return lines.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
    const bpmn = generateBPMN(flow);
    writeFileSync(join(outputDir, `${flow.flow}.bpmn`), bpmn);
    console.log(`  ✓ ${flow.flow}.bpmn`);
  } catch (e) {
    console.error(`  ✗ ${flow.flow}.bpmn: ${(e as Error).message}`);
  }
}
