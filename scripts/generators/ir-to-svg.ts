import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, layoutNodes, getNodeColor, escapeXml, COLORS, type IRFlow, type PositionedNode, type IREdge } from './shared.js';

function nodeToSVG(node: PositionedNode): string {
  const { x, y } = node.position;
  const fill = getNodeColor(node.logic_type);

  switch (node.type) {
    case 'task':
      return `  <g>
    <rect x="${x}" y="${y}" width="180" height="50" rx="8" fill="${COLORS.nodeBg}" stroke="${fill}" stroke-width="2"/>
    <text x="${x + 90}" y="${y + 30}" text-anchor="middle" fill="${COLORS.text}" font-size="12" font-family="system-ui, sans-serif">${escapeXml(node.label)}</text>
  </g>`;
    case 'decision':
    case 'parallel_split':
    case 'parallel_join': {
      const cx = x + 30;
      const cy = y + 30;
      const s = 28;
      return `  <g>
    <polygon points="${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}" fill="${COLORS.nodeBg}" stroke="${fill}" stroke-width="2"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${COLORS.text}" font-size="9" font-family="system-ui, sans-serif">${escapeXml(node.label.length > 15 ? node.label.slice(0, 12) + '...' : node.label)}</text>
  </g>`;
    }
    case 'start':
      return `  <g>
    <circle cx="${x + 20}" cy="${y + 20}" r="18" fill="none" stroke="${fill}" stroke-width="2"/>
    <text x="${x + 20}" y="${y + 24}" text-anchor="middle" fill="${COLORS.text}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(node.label)}</text>
  </g>`;
    case 'end':
      return `  <g>
    <circle cx="${x + 20}" cy="${y + 20}" r="18" fill="none" stroke="${fill}" stroke-width="3"/>
    <text x="${x + 20}" y="${y + 24}" text-anchor="middle" fill="${COLORS.text}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(node.label)}</text>
  </g>`;
    default:
      return '';
  }
}

function edgeToSVG(edge: IREdge, positioned: PositionedNode[]): string {
  const fromNode = positioned.find(n => n.id === edge.from);
  const toNode = positioned.find(n => n.id === edge.to);
  if (!fromNode || !toNode) return '';

  const fromX = fromNode.position.x + fromNode.width;
  const fromY = fromNode.position.y + fromNode.height / 2;
  const toX = toNode.position.x;
  const toY = toNode.position.y + toNode.height / 2;

  const midX = (fromX + toX) / 2;

  let svg = `  <path d="M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}" fill="none" stroke="#555" stroke-width="1.5" marker-end="url(#arrowhead)"/>`;

  if (edge.condition) {
    const labelX = midX;
    const labelY = (fromY + toY) / 2 - 8;
    svg += `\n  <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#999" font-size="10" font-family="system-ui, sans-serif">${escapeXml(edge.condition)}</text>`;
  }

  return svg;
}

export function generateSVG(flow: IRFlow): string {
  const positioned = layoutNodes(flow.nodes, flow.edges);

  // Calculate SVG dimensions
  let maxX = 0, maxY = 0;
  for (const node of positioned) {
    maxX = Math.max(maxX, node.position.x + node.width);
    maxY = Math.max(maxY, node.position.y + node.height);
  }

  const padding = 60;
  const width = maxX + padding * 2;
  const height = maxY + padding * 2;

  const nodesSvg = positioned.map(n => nodeToSVG(n)).join('\n');
  const edgesSvg = flow.edges.map(e => edgeToSVG(e, positioned)).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#555"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${COLORS.bg}"/>
  <g transform="translate(${padding}, ${padding})">
${edgesSvg}
${nodesSvg}
  </g>
  <text x="${padding}" y="${height - 15}" fill="#666" font-size="11" font-family="system-ui, sans-serif">${escapeXml(flow.title)}</text>
</svg>`;
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

for (const flow of flows) {
  const svg = generateSVG(flow);
  writeFileSync(join(outputDir, `${flow.flow}.svg`), svg);
  console.log(`  ✓ ${flow.flow}.svg`);
}
