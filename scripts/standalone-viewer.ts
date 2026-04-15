#!/usr/bin/env npx tsx
/**
 * Standalone flow viewer — zero-dependency HTTP server that renders IR YAML
 * files as an interactive browsable web app with inline SVG diagrams.
 *
 * Usage: npx tsx standalone-viewer.ts [docs/flows/]
 * Runs on http://localhost:3200
 */

import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flowsDir = resolve(process.argv[2] || join(__dirname, '..', 'docs', 'flows'));
const PORT = 3200;

if (!existsSync(flowsDir)) {
  console.error(`  Error: ${flowsDir} not found. Run /scan-logic and /extract-logic first.`);
  process.exit(1);
}

// ── YAML Parser ──────────────────────────────────────────────────────

interface IRStep {
  id: string;
  label: string;
  logic_type?: string;
  calls?: string;
  note?: string;
  on_error?: string;
  outcome?: Record<string, string>;
  substeps?: IRStep[];
  config?: string;
}

interface IRFile {
  id: string;
  name: string;
  description: string;
  source: { file: string; function: string; line: number };
  status: string;
  tags: string[];
  steps: IRStep[];
}

function parseYaml(text: string): IRFile {
  const lines = text.split('\n');
  const result: any = { source: {}, tags: [], steps: [] };
  let currentStep: any = null;
  let currentSubstep: any = null;
  let inSteps = false;
  let inSubsteps = false;
  let inOutcome = false;
  let outcomeTarget: any = null;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (!inSteps) {
      if (line.startsWith('id: ')) result.id = line.slice(4).trim();
      else if (line.startsWith('name: ')) result.name = line.slice(6).trim();
      else if (line.startsWith('description: ')) result.description = line.slice(13).trim();
      else if (line.startsWith('status: ')) result.status = line.slice(8).trim();
      else if (line.startsWith('tags: ')) {
        result.tags = line.slice(6).replace(/[\[\]]/g, '').split(',').map((s: string) => s.trim());
      }
      else if (line.startsWith('  file: ')) result.source.file = line.slice(8).trim();
      else if (line.startsWith('  function: ')) result.source.function = line.slice(12).trim();
      else if (line.startsWith('  line: ')) result.source.line = parseInt(line.slice(8).trim(), 10);
      else if (line.startsWith('steps:')) inSteps = true;
    } else {
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;
      if (trimmed.startsWith('- id: ')) {
        if (indent <= 4) {
          inSubsteps = false; inOutcome = false; currentSubstep = null;
          currentStep = { id: trimmed.slice(6).trim(), label: '', logic_type: 'deterministic', outcome: {} };
          result.steps.push(currentStep);
          outcomeTarget = currentStep;
        } else if (inSubsteps) {
          currentSubstep = { id: trimmed.slice(6).trim(), label: '', logic_type: 'deterministic', outcome: {} };
          if (!currentStep.substeps) currentStep.substeps = [];
          currentStep.substeps.push(currentSubstep);
          outcomeTarget = currentSubstep;
          inOutcome = false;
        }
      } else if (trimmed.startsWith('label: ')) {
        const val = trimmed.slice(7).trim().replace(/^["']|["']$/g, '');
        if (currentSubstep && inSubsteps) currentSubstep.label = val;
        else if (currentStep) currentStep.label = val;
      } else if (trimmed.startsWith('logic_type: ')) {
        const val = trimmed.slice(12).trim();
        if (currentSubstep && inSubsteps) currentSubstep.logic_type = val;
        else if (currentStep) currentStep.logic_type = val;
      } else if (trimmed.startsWith('calls: ')) {
        const val = trimmed.slice(7).trim();
        if (currentSubstep && inSubsteps) currentSubstep.calls = val;
        else if (currentStep) currentStep.calls = val;
      } else if (trimmed.startsWith('note: ')) {
        const val = trimmed.slice(6).trim();
        if (currentSubstep && inSubsteps) currentSubstep.note = val;
        else if (currentStep) currentStep.note = val;
      } else if (trimmed.startsWith('on_error: ')) {
        const val = trimmed.slice(10).trim();
        if (currentSubstep && inSubsteps) currentSubstep.on_error = val;
        else if (currentStep) currentStep.on_error = val;
      } else if (trimmed.startsWith('config: ')) {
        const val = trimmed.slice(8).trim();
        if (currentStep) currentStep.config = val;
      } else if (trimmed === 'substeps:') {
        inSubsteps = true; inOutcome = false;
      } else if (trimmed === 'outcome:' || trimmed.startsWith('outcome:')) {
        inOutcome = true;
      } else if (inOutcome && trimmed.includes(':') && !trimmed.startsWith('- ')) {
        const ci = trimmed.indexOf(':');
        if (outcomeTarget) outcomeTarget.outcome[ci > 0 ? trimmed.slice(0, ci).trim() : ''] = trimmed.slice(ci + 1).trim();
      }
    }
  }
  return result as IRFile;
}

// ── Load all flows ──────────────────────────────────────────────────

function loadFlows(): IRFile[] {
  return readdirSync(flowsDir)
    .filter((f: string) => f.endsWith('.yaml'))
    .sort()
    .map((f: string) => {
      try { return parseYaml(readFileSync(join(flowsDir, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(Boolean) as IRFile[];
}

// ── HTML Template ───────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderIndex(flows: IRFile[]): string {
  // Group flows by ID prefix
  const groups: Record<string, IRFile[]> = {};
  for (const f of flows) {
    const prefix = f.id.split('-')[0];
    (groups[prefix] ??= []).push(f);
  }

  const groupOrder = Object.keys(groups).sort();

  let sidebar = '';
  for (const g of groupOrder) {
    sidebar += `<div class="group-label">${esc(g.toUpperCase())}</div>`;
    for (const f of groups[g]) {
      const tags = (f.tags || []).map((t: string) => {
        const cls = t.includes('ai') || t.includes('prob') ? 'tag-ai'
          : t.includes('mutation') ? 'tag-mut'
          : t.includes('external') ? 'tag-ext'
          : t.includes('entry') ? 'tag-entry'
          : t.includes('decision') ? 'tag-dec'
          : 'tag-other';
        return `<span class="tag ${cls}">${esc(t)}</span>`;
      }).join('');
      sidebar += `<a class="flow-link" href="#" data-id="${esc(f.id)}">${esc(f.name)}${tags}</a>`;
    }
  }

  const flowsJson = JSON.stringify(flows.map(f => ({
    id: f.id, name: f.name, description: f.description,
    source: f.source, status: f.status, tags: f.tags,
    steps: f.steps,
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flow Viewer</title>
<style>
  :root { --bg: #0d1117; --bg2: #161b22; --bg3: #1c2128; --border: #30363d; --text: #c9d1d9; --text2: #8b949e; --accent: #58a6ff; --green: #3fb950; --yellow: #d29922; --red: #f85149; --purple: #bc8cff; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }

  /* Sidebar */
  .sidebar { width: 280px; min-width: 280px; background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
  .sidebar-header { padding: 16px; border-bottom: 1px solid var(--border); }
  .sidebar-header h2 { font-size: 14px; color: var(--text); margin-bottom: 8px; }
  .search { width: 100%; padding: 6px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; outline: none; }
  .search:focus { border-color: var(--accent); }
  .sidebar-body { flex: 1; overflow-y: auto; padding: 8px 0; }
  .group-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text2); padding: 12px 16px 4px; letter-spacing: 0.5px; }
  .flow-link { display: block; padding: 6px 16px; font-size: 13px; color: var(--text); text-decoration: none; cursor: pointer; border-left: 3px solid transparent; transition: all 0.15s; }
  .flow-link:hover { background: var(--bg3); }
  .flow-link.active { background: var(--bg3); border-left-color: var(--accent); color: var(--accent); }
  .flow-link.hidden { display: none; }
  .tag { font-size: 9px; padding: 1px 5px; border-radius: 3px; margin-left: 4px; vertical-align: middle; }
  .tag-ai { background: rgba(248,81,73,0.2); color: var(--red); }
  .tag-mut { background: rgba(188,140,255,0.2); color: var(--purple); }
  .tag-ext { background: rgba(88,166,255,0.2); color: var(--accent); }
  .tag-entry { background: rgba(63,185,80,0.2); color: var(--green); }
  .tag-dec { background: rgba(210,153,34,0.2); color: var(--yellow); }
  .tag-other { background: rgba(139,148,158,0.2); color: var(--text2); }
  .stats { font-size: 11px; color: var(--text2); padding: 8px 16px; border-top: 1px solid var(--border); }

  /* Main */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .main-header { padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg2); }
  .main-header h1 { font-size: 18px; margin-bottom: 2px; }
  .main-header .desc { font-size: 13px; color: var(--text2); }
  .main-header .meta { font-size: 12px; color: var(--text2); margin-top: 4px; }
  .main-header .meta a { color: var(--accent); text-decoration: none; }
  .main-body { flex: 1; overflow: auto; padding: 24px; }

  /* Legend */
  .legend { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 3px; }

  /* SVG Flow diagram */
  .flow-canvas { overflow-x: auto; }
  .flow-canvas svg { max-width: 100%; height: auto; }
  .flow-canvas .node rect { rx: 6; ry: 6; stroke-width: 1.5; }
  .flow-canvas .node text { font-size: 11px; fill: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .flow-canvas .edge line, .flow-canvas .edge polyline { stroke: #30363d; stroke-width: 1.5; fill: none; }
  .flow-canvas .edge-label { font-size: 9px; fill: #8b949e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .flow-canvas .det rect { fill: #0d2818; stroke: #3fb950; }
  .flow-canvas .cfg rect { fill: #2d1b00; stroke: #d29922; }
  .flow-canvas .prob rect { fill: #2d0a0a; stroke: #f85149; }
  .flow-canvas .mut rect { fill: #1b0d30; stroke: #bc8cff; }
  .flow-canvas .end rect { fill: #161b22; stroke: #484f58; }
  .flow-canvas .badge { font-size: 9px; fill: #8b949e; }
  .flow-canvas .node:hover rect { stroke-width: 2.5; filter: brightness(1.2); cursor: pointer; }
  .flow-canvas .node .on-error-text { font-size: 8px; fill: #f85149; }

  /* Empty state */
  .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text2); font-size: 15px; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>

<div class="sidebar">
  <div class="sidebar-header">
    <h2>Flow Viewer</h2>
    <input class="search" placeholder="Search flows..." id="search" />
  </div>
  <div class="sidebar-body" id="sidebar-body">${sidebar}</div>
  <div class="stats">${flows.length} flows</div>
</div>

<div class="main">
  <div class="main-header" id="main-header" style="display:none">
    <h1 id="flow-name"></h1>
    <div class="desc" id="flow-desc"></div>
    <div class="meta" id="flow-meta"></div>
  </div>
  <div class="main-body" id="main-body">
    <div class="empty" id="empty-state">Select a flow from the sidebar</div>
    <div id="flow-content" style="display:none">
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:#3fb950"></div> Deterministic</div>
        <div class="legend-item"><div class="legend-dot" style="background:#d29922"></div> Configurable</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f85149"></div> Probabilistic (AI)</div>
        <div class="legend-item"><div class="legend-dot" style="background:#bc8cff"></div> Data Mutation</div>
        <div class="legend-item"><div class="legend-dot" style="background:#484f58"></div> Exit / End</div>
      </div>
      <div class="flow-canvas" id="flow-canvas"></div>
    </div>
  </div>
</div>

<script>
const FLOWS = ${flowsJson};
const flowMap = Object.fromEntries(FLOWS.map(f => [f.id, f]));

// Search
document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.flow-link').forEach(el => {
    const name = el.textContent.toLowerCase();
    const id = el.dataset.id;
    el.classList.toggle('hidden', q && !name.includes(q) && !id.includes(q));
  });
});

// Click handler
document.getElementById('sidebar-body').addEventListener('click', e => {
  const link = e.target.closest('.flow-link');
  if (!link) return;
  e.preventDefault();
  document.querySelectorAll('.flow-link').forEach(l => l.classList.remove('active'));
  link.classList.add('active');
  renderFlow(flowMap[link.dataset.id]);
});

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── SVG diagram renderer ────────────────────────────────────────────

function logicCls(type) {
  if (type === 'configurable') return 'cfg';
  if (type === 'probabilistic') return 'prob';
  return 'det';
}

function wrapText(text, maxChars) {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function renderSvgDiagram(flow) {
  const NODE_W = 400;
  const NODE_H = 48;
  const V_GAP = 60;
  const BRANCH_X_OFFSET = 440;
  const CENTER_X = 40;
  const END_W = 260;
  const MAX_LABEL_CHARS = 48;
  const MAX_BADGE_CHARS = 55;

  // Flatten steps (inline substeps)
  const allSteps = [];
  for (const step of flow.steps) {
    allSteps.push(step);
    if (step.substeps) {
      for (const sub of step.substeps) allSteps.push(sub);
    }
  }

  // Layout pass: compute positions
  const nodes = [];
  const edges = [];
  const endNodes = [];
  let y = 10;

  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    const cls = logicCls(step.logic_type);
    const labelLines = wrapText(step.label || step.id, MAX_LABEL_CHARS);
    let badgeText = '';
    if (step.calls) badgeText = 'calls: ' + step.calls;
    else if (step.config) badgeText = 'config: ' + step.config;
    else if (step.note) badgeText = step.note.length > 60 ? step.note.slice(0, 57) + '...' : step.note;
    const badgeLines = badgeText ? wrapText(badgeText, MAX_BADGE_CHARS) : [];

    const totalTextLines = labelLines.length + badgeLines.length;
    const nodeH = Math.max(NODE_H, 20 + totalTextLines * 16 + (badgeLines.length > 0 ? 8 : 0));

    nodes.push({
      x: CENTER_X, y, w: NODE_W, h: nodeH, cls, lines: labelLines,
      badgeLines, id: step.id, onError: step.on_error || null
    });

    // Branch exits from outcomes
    const outcomes = step.outcome ? Object.entries(step.outcome) : [];
    let branchY = y;
    for (const [key, val] of outcomes) {
      const isExit = /stop|return|throw|skip|deny|reject|done$|silently/i.test(val);
      if (isExit) {
        const endValLines = wrapText(val, 30);
        const endH = 36 + endValLines.length * 13;
        endNodes.push({
          x: CENTER_X + BRANCH_X_OFFSET, y: branchY, w: END_W, h: endH,
          cls: 'end', lines: endValLines, id: step.id + '-' + key
        });
        edges.push({
          x1: CENTER_X + NODE_W, y1: y + nodeH / 2,
          x2: CENTER_X + BRANCH_X_OFFSET, y2: branchY + endH / 2,
          label: key.replace(/_/g, ' '), isBranch: true
        });
        branchY += endH + 8;
      }
    }

    // Vertical edge to next step
    if (i < allSteps.length - 1) {
      edges.push({
        x1: CENTER_X + NODE_W / 2, y1: y + nodeH,
        x2: CENTER_X + NODE_W / 2, y2: y + nodeH + V_GAP,
        isBranch: false
      });
    }

    y += nodeH + V_GAP;
  }

  // Determine SVG dimensions
  const maxEndX = endNodes.length > 0
    ? Math.max(...endNodes.map(n => n.x + n.w)) + 40
    : CENTER_X + NODE_W + 60;
  const svgW = Math.max(maxEndX, CENTER_X + NODE_W + BRANCH_X_OFFSET + END_W + 40);
  const maxEndY = endNodes.length > 0 ? Math.max(...endNodes.map(n => n.y + n.h)) : 0;
  const svgH = Math.max(y + 10, maxEndY + 20);

  // Render SVG
  let svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">';
  svg += '<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#30363d"/></marker>';
  svg += '<marker id="arrow-branch" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#484f58"/></marker></defs>';

  // Draw edges
  svg += '<g class="edge">';
  for (const e of edges) {
    if (e.isBranch) {
      svg += '<polyline points="' + e.x1 + ',' + e.y1 + ' ' + (e.x1 + 20) + ',' + e.y1 + ' ' + (e.x2 - 10) + ',' + e.y2 + ' ' + e.x2 + ',' + e.y2 + '" marker-end="url(#arrow-branch)" />';
      if (e.label) {
        const mx = (e.x1 + e.x2) / 2;
        const my = Math.min(e.y1, e.y2) - 4;
        svg += '<text class="edge-label" x="' + mx + '" y="' + my + '" text-anchor="middle">' + esc(e.label) + '</text>';
      }
    } else {
      svg += '<line x1="' + e.x1 + '" y1="' + e.y1 + '" x2="' + e.x2 + '" y2="' + e.y2 + '" marker-end="url(#arrow)" />';
    }
  }
  svg += '</g>';

  // Draw main nodes
  for (const n of nodes) {
    svg += '<g class="node ' + n.cls + '" transform="translate(' + n.x + ',' + n.y + ')">';
    svg += '<rect width="' + n.w + '" height="' + n.h + '"/>';
    const totalTextH = n.lines.length * 14 + n.badgeLines.length * 12 + (n.badgeLines.length > 0 ? 6 : 0);
    const textStartY = (n.h - totalTextH) / 2 + 12;
    for (let li = 0; li < n.lines.length; li++) {
      svg += '<text x="' + (n.w/2) + '" y="' + (textStartY + li * 14) + '" text-anchor="middle">' + esc(n.lines[li]) + '</text>';
    }
    if (n.badgeLines.length > 0) {
      const badgeStartY = textStartY + n.lines.length * 14 + 6;
      for (let bi = 0; bi < n.badgeLines.length; bi++) {
        svg += '<text x="' + (n.w/2) + '" y="' + (badgeStartY + bi * 12) + '" text-anchor="middle" class="badge">' + esc(n.badgeLines[bi]) + '</text>';
      }
    }
    if (n.onError) {
      svg += '<text x="' + n.w + '" y="' + (n.h + 12) + '" text-anchor="end" class="on-error-text">on error: ' + esc(n.onError) + '</text>';
    }
    svg += '</g>';
  }

  // Draw end/exit nodes
  for (const n of endNodes) {
    svg += '<g class="node end" transform="translate(' + n.x + ',' + n.y + ')">';
    svg += '<rect width="' + n.w + '" height="' + n.h + '" rx="12" ry="12" stroke-dasharray="4,3" />';
    for (let li = 0; li < n.lines.length; li++) {
      svg += '<text x="' + (n.w/2) + '" y="' + (n.h/2 - ((n.lines.length-1)*6.5) + li*13 + 4) + '" text-anchor="middle" style="font-size:10px">' + esc(n.lines[li]) + '</text>';
    }
    svg += '</g>';
  }

  svg += '</svg>';
  return svg;
}

function renderFlow(flow) {
  if (!flow) return;
  document.getElementById('main-header').style.display = '';
  document.getElementById('flow-name').textContent = flow.name;
  document.getElementById('flow-desc').textContent = flow.description;

  const src = flow.source;
  document.getElementById('flow-meta').innerHTML =
    (src.file ? esc(src.file) + ':' + src.line + ' &middot; ' + esc(src.function) : '') +
    ' &middot; status: ' + flow.status +
    ' &middot; ' + (flow.tags || []).map(t => '<span class="tag tag-other">' + esc(t) + '</span>').join(' ');

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('flow-content').style.display = '';
  document.getElementById('flow-canvas').innerHTML = renderSvgDiagram(flow);
}

// Auto-select first
if (FLOWS.length > 0) {
  const first = document.querySelector('.flow-link');
  if (first) { first.click(); }
}
</script>
</body>
</html>`;
}

// ── Server ──────────────────────────────────────────────────────────

const server = createServer((_req: any, res: any) => {
  const flows = loadFlows();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderIndex(flows));
});

server.listen(PORT, () => {
  console.log(`\n  Flow Viewer running at http://localhost:${PORT}`);
  console.log(`  Serving ${readdirSync(flowsDir).filter((f: string) => f.endsWith('.yaml')).length} flows from ${flowsDir}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
