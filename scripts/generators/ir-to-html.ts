import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadFlows, ensureOutputDir, escapeXml, type IRFlow } from './shared.js';
import { generateSVG } from './ir-to-svg.js';

function generateHTML(flow: IRFlow): string {
  const svgContent = generateSVG(flow);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(flow.title)}</title>
  <style>
    body { margin: 0; background: #0f0f0f; display: flex; justify-content: center; padding: 40px; }
    svg { max-width: 100%; height: auto; }
    h1 { color: #e0e0e0; font-family: system-ui, sans-serif; font-size: 18px; text-align: center; margin-bottom: 8px; }
    p { color: #999; font-family: system-ui, sans-serif; font-size: 13px; text-align: center; max-width: 600px; margin: 0 auto 24px; }
    .container { display: flex; flex-direction: column; align-items: center; }
    .legend { display: flex; gap: 16px; margin-bottom: 24px; }
    .legend-item { display: flex; align-items: center; gap: 6px; color: #999; font-family: system-ui, sans-serif; font-size: 12px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeXml(flow.title)}</h1>
    <p>${escapeXml(flow.description || '')}</p>
    <div class="legend">
      <div class="legend-item"><div class="legend-dot" style="background: #22c55e;"></div> Deterministic</div>
      <div class="legend-item"><div class="legend-dot" style="background: #f59e0b;"></div> Configurable</div>
      <div class="legend-item"><div class="legend-dot" style="background: #8b5cf6;"></div> Probabilistic</div>
    </div>
    ${svgContent}
  </div>
</body>
</html>`;
}

// ─── Main ───

const flows = loadFlows();
const outputDir = ensureOutputDir();

if (flows.length === 0) {
  console.log('No IR files found in docs/flows/');
  process.exit(0);
}

for (const flow of flows) {
  const html = generateHTML(flow);
  writeFileSync(join(outputDir, `${flow.flow}.html`), html);
  console.log(`  ✓ ${flow.flow}.html`);
}
