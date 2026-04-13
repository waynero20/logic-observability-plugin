import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, escapeXml, type IRFlow } from './shared.js';

function generateXML(flow: IRFlow): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<flow id="${escapeXml(flow.flow)}" version="${flow.version || 1}" status="${escapeXml(flow.status)}">`);
  lines.push(`  <title>${escapeXml(flow.title)}</title>`);
  lines.push(`  <description>${escapeXml(flow.description || '')}</description>`);
  if (flow.service) lines.push(`  <service>${escapeXml(flow.service)}</service>`);
  if (flow.module) lines.push(`  <module>${escapeXml(flow.module)}</module>`);
  if (flow.last_extracted) lines.push(`  <last_extracted>${escapeXml(flow.last_extracted)}</last_extracted>`);

  lines.push('');
  lines.push('  <nodes>');
  for (const node of flow.nodes) {
    const attrs: string[] = [
      `id="${escapeXml(node.id)}"`,
      `type="${escapeXml(node.type)}"`,
    ];
    if (node.logic_type) attrs.push(`logic_type="${escapeXml(node.logic_type)}"`);
    if (node.confidence) attrs.push(`confidence="${escapeXml(node.confidence)}"`);

    lines.push(`    <node ${attrs.join(' ')}>`);
    lines.push(`      <label>${escapeXml(node.label)}</label>`);
    if (node.description) lines.push(`      <description>${escapeXml(node.description)}</description>`);
    if (node.code_ref) lines.push(`      <code_ref>${escapeXml(node.code_ref)}</code_ref>`);
    if (node.calls && node.calls.length > 0) {
      lines.push('      <calls>');
      for (const call of node.calls) lines.push(`        <call>${escapeXml(call)}</call>`);
      lines.push('      </calls>');
    }
    if (node.span_name) lines.push(`      <span_name>${escapeXml(node.span_name)}</span_name>`);
    if (node.decision_point) lines.push(`      <decision_point>${escapeXml(node.decision_point)}</decision_point>`);
    if (node.reason_codes && node.reason_codes.length > 0) {
      lines.push('      <reason_codes>');
      for (const code of node.reason_codes) lines.push(`        <code>${escapeXml(code)}</code>`);
      lines.push('      </reason_codes>');
    }
    if (node.model) lines.push(`      <model>${escapeXml(node.model)}</model>`);
    lines.push('    </node>');
  }
  lines.push('  </nodes>');

  lines.push('');
  lines.push('  <edges>');
  for (const edge of flow.edges) {
    const attrs: string[] = [
      `from="${escapeXml(edge.from)}"`,
      `to="${escapeXml(edge.to)}"`,
    ];
    if (edge.condition) attrs.push(`condition="${escapeXml(edge.condition)}"`);
    if (edge.reason_code) attrs.push(`reason_code="${escapeXml(edge.reason_code)}"`);
    if (edge.confidence) attrs.push(`confidence="${escapeXml(edge.confidence)}"`);

    if (edge.runtime) {
      lines.push(`    <edge ${attrs.join(' ')}>`);
      lines.push('      <runtime>');
      lines.push(`        <observed>${edge.runtime.observed}</observed>`);
      if (edge.runtime.frequency !== undefined) lines.push(`        <frequency>${edge.runtime.frequency}</frequency>`);
      if (edge.runtime.error_rate !== undefined) lines.push(`        <error_rate>${edge.runtime.error_rate}</error_rate>`);
      if (edge.runtime.avg_latency_ms !== undefined) lines.push(`        <avg_latency_ms>${edge.runtime.avg_latency_ms}</avg_latency_ms>`);
      lines.push('      </runtime>');
      lines.push('    </edge>');
    } else {
      lines.push(`    <edge ${attrs.join(' ')}/>`);
    }
  }
  lines.push('  </edges>');

  lines.push('');
  lines.push(`  <entry_point>${escapeXml(flow.entry_point)}</entry_point>`);
  lines.push('  <exit_points>');
  for (const ep of flow.exit_points) lines.push(`    <exit_point>${escapeXml(ep)}</exit_point>`);
  lines.push('  </exit_points>');

  if (flow.estimated_duration_ms) lines.push(`  <estimated_duration_ms>${escapeXml(flow.estimated_duration_ms)}</estimated_duration_ms>`);
  if (flow.error_modes && flow.error_modes.length > 0) {
    lines.push('  <error_modes>');
    for (const mode of flow.error_modes) lines.push(`    <error_mode>${escapeXml(mode)}</error_mode>`);
    lines.push('  </error_modes>');
  }

  lines.push('</flow>');
  return lines.join('\n');
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

for (const flow of flows) {
  const xml = generateXML(flow);
  writeFileSync(join(outputDir, `${flow.flow}.xml`), xml);
  console.log(`  ✓ ${flow.flow}.xml`);
}
