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
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flowsDir = resolve(process.argv[2] || join(__dirname, '..', 'docs', 'flows'));
const PORT = 3200;

if (!existsSync(flowsDir)) {
  console.error(`  Error: ${flowsDir} not found. Run /scan-logic and /extract-logic first.`);
  process.exit(1);
}

// ── Types ───────────────────────────────────────────────────────────

interface IRNode {
  id: string;
  type: 'task' | 'decision' | 'start' | 'end' | 'parallel_split' | 'parallel_join';
  label: string;
  logic_type?: string;
  description?: string;
  calls?: string[];
  code_ref?: string;
  on_error?: string;
  outcome?: Record<string, string>;
  substeps?: any[];
  config?: string;
  note?: string;
}

interface IREdge {
  from: string;
  to: string;
  condition?: string;
}

interface IRFlow {
  id: string;
  name: string;
  description: string;
  source?: { file?: string; function?: string; line?: number };
  status: string;
  tags: string[];
  nodes: IRNode[];
  edges: IREdge[];
}

// ── Normalize any YAML format into a unified flow ────────────────────

function normalizeFlow(raw: any): IRFlow | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id || raw.flow || null;
  const name = raw.name || raw.title || id || null;
  if (!id) return null;

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const status = raw.status || 'draft';
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const source = raw.source || {};

  // Already in nodes/edges IR format
  if (Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
    const nodes: IRNode[] = raw.nodes.map((n: any) => ({
      id: n.id,
      type: n.type || 'task',
      label: n.label || n.id,
      logic_type: n.logic_type,
      description: n.description,
      calls: Array.isArray(n.calls) ? n.calls : undefined,
      code_ref: n.code_ref,
    }));
    const edges: IREdge[] = raw.edges.map((e: any) => ({
      from: e.from,
      to: e.to,
      condition: e.condition,
    }));
    return { id, name, description, source, status, tags, nodes, edges };
  }

  // Steps format: convert to nodes/edges
  if (Array.isArray(raw.steps) && raw.steps.length > 0) {
    const nodes: IRNode[] = [];
    const edges: IREdge[] = [];

    // Flatten steps + substeps
    const allSteps: any[] = [];
    for (const step of raw.steps) {
      allSteps.push(step);
      if (Array.isArray(step.substeps)) {
        for (const sub of step.substeps) allSteps.push(sub);
      }
    }

    nodes.push({ id: '__start', type: 'start', label: 'Start' });

    for (const step of allSteps) {
      const hasOutcome = step.outcome && typeof step.outcome === 'object' && Object.keys(step.outcome).length > 0;
      const callsList = step.calls
        ? (typeof step.calls === 'string' ? step.calls.split(',').map((s: string) => s.trim()) : step.calls)
        : undefined;

      nodes.push({
        id: step.id,
        type: hasOutcome ? 'decision' : 'task',
        label: step.label || step.id,
        logic_type: step.logic_type || 'deterministic',
        calls: callsList,
        description: step.description,
        code_ref: step.code_ref,
        on_error: step.on_error,
        outcome: step.outcome,
        config: step.config,
        note: step.note,
      });
    }

    nodes.push({ id: '__end', type: 'end', label: 'End' });

    // Build edges: sequential chain with branch exits for outcomes
    edges.push({ from: '__start', to: allSteps[0].id });
    for (let i = 0; i < allSteps.length - 1; i++) {
      edges.push({ from: allSteps[i].id, to: allSteps[i + 1].id });
    }
    edges.push({ from: allSteps[allSteps.length - 1].id, to: '__end' });

    // Add outcome branch edges
    for (const step of allSteps) {
      if (step.outcome && typeof step.outcome === 'object') {
        for (const [key, val] of Object.entries(step.outcome)) {
          const isExit = /stop|return|throw|skip|deny|reject|done$|silently/i.test(val as string);
          if (isExit) {
            const exitId = `${step.id}__exit_${key}`;
            nodes.push({ id: exitId, type: 'end', label: val as string });
            edges.push({ from: step.id, to: exitId, condition: key.replace(/_/g, ' ') });
          }
        }
      }
    }

    return { id, name, description, source, status, tags, nodes, edges };
  }

  return null;
}

// ── Load all flows ──────────────────────────────────────────────────

function loadFlows(): IRFlow[] {
  return readdirSync(flowsDir)
    .filter((f: string) => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.'))
    .sort()
    .map((f: string) => {
      try {
        const raw = yaml.load(readFileSync(join(flowsDir, f), 'utf-8'));
        return normalizeFlow(raw);
      } catch { return null; }
    })
    .filter(Boolean) as IRFlow[];
}

// ── HTML Template ───────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderIndex(flows: IRFlow[]): string {
  // Group flows by ID prefix
  const groups: Record<string, IRFlow[]> = {};
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

  const flowsJson = JSON.stringify(flows);

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
  .main-body { flex: 1; overflow: hidden; padding: 24px; display: flex; flex-direction: column; }

  /* Legend */
  .legend { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 3px; }

  /* SVG Flow diagram */
  .flow-canvas { overflow: hidden; position: relative; flex: 1; min-height: 0; }
  .flow-canvas svg { display: block; cursor: grab; transform-origin: 0 0; }
  .flow-canvas svg:active { cursor: grabbing; }

  /* Zoom controls */
  .zoom-controls { position: absolute; top: 12px; right: 12px; display: flex; gap: 4px; z-index: 10; }
  .zoom-btn { width: 32px; height: 32px; border: 1px solid var(--border); background: var(--bg2); color: var(--text); border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .zoom-btn:hover { background: var(--bg3); }
  .zoom-level { font-size: 11px; color: var(--text2); padding: 0 6px; display: flex; align-items: center; user-select: none; }

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
        <div class="legend-item"><div class="legend-dot" style="background:#bc8cff"></div> Probabilistic (AI)</div>
        <div class="legend-item"><div class="legend-dot" style="background:#484f58"></div> Exit / End</div>
      </div>
      <div class="flow-canvas" id="flow-canvas">
        <div class="zoom-controls">
          <button class="zoom-btn" id="zoom-in" title="Zoom in">+</button>
          <button class="zoom-btn" id="zoom-out" title="Zoom out">&minus;</button>
          <span class="zoom-level" id="zoom-level">100%</span>
          <button class="zoom-btn" id="zoom-fit" title="Fit to view">&#x2922;</button>
          <button class="zoom-btn" id="zoom-reset" title="Reset zoom">1:1</button>
        </div>
      </div>
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

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Graph layout (simple layered/Sugiyama-lite for LR flow) ──────

function layoutGraph(nodes, edges) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDeg = new Map(nodes.map(n => [n.id, 0]));
  const adj = new Map(nodes.map(n => [n.id, []]));

  for (const e of edges) {
    if (nodeMap.has(e.from) && nodeMap.has(e.to)) {
      adj.get(e.from).push(e.to);
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    }
  }

  // Topological sort to assign ranks (layers)
  const rank = new Map();
  const queue = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) { queue.push(id); rank.set(id, 0); }
  }

  while (queue.length > 0) {
    const cur = queue.shift();
    const curRank = rank.get(cur);
    for (const next of (adj.get(cur) || [])) {
      const newRank = curRank + 1;
      if (!rank.has(next) || rank.get(next) < newRank) {
        rank.set(next, newRank);
      }
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  // Handle any unranked nodes (cycles or disconnected)
  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, 0);
  }

  // Group by rank
  const layers = new Map();
  for (const n of nodes) {
    const r = rank.get(n.id);
    if (!layers.has(r)) layers.set(r, []);
    layers.get(r).push(n);
  }

  return { rank, layers };
}

// ── SVG diagram renderer (graph-based) ──────────────────────────────

function renderSvgDiagram(flow) {
  const PAD = 40;
  const H_GAP = 200;  // horizontal gap between layers
  const V_GAP = 60;   // vertical gap between nodes in same layer
  const MAX_LABEL = 28;

  const nodes = flow.nodes;
  const edges = flow.edges;

  if (!nodes || nodes.length === 0) {
    return '<svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg"><text x="200" y="40" text-anchor="middle" fill="#8b949e" font-size="14" font-family="system-ui, sans-serif">No nodes to display</text></svg>';
  }

  const { rank, layers } = layoutGraph(nodes, edges);

  // Compute node dimensions
  function nodeDims(n) {
    const label = n.label || n.id;
    if (n.type === 'start' || n.type === 'end') return { w: 100, h: 50 };
    if (n.type === 'decision' || n.type === 'parallel_split' || n.type === 'parallel_join') {
      const w = Math.max(120, Math.min(200, label.length * 7 + 40));
      return { w, h: 70 };
    }
    // task
    const callsText = Array.isArray(n.calls) && n.calls.length > 0 ? n.calls.join(', ') : '';
    const textLen = Math.max(label.length, callsText.length);
    const w = Math.max(180, Math.min(320, textLen * 7.5 + 40));
    const charsPerLine = Math.floor((w - 30) / 7);
    const labelLines = Math.max(1, Math.ceil(label.length / charsPerLine));
    const callsLines = callsText ? Math.max(1, Math.ceil(callsText.length / charsPerLine)) : 0;
    const h = Math.max(50, 30 + (labelLines + callsLines) * 16);
    return { w, h };
  }

  const dims = new Map();
  for (const n of nodes) dims.set(n.id, nodeDims(n));

  // Position nodes: x by rank, y by order in layer
  const pos = new Map();
  const sortedRanks = [...layers.keys()].sort((a, b) => a - b);

  let x = PAD;
  for (const r of sortedRanks) {
    const layerNodes = layers.get(r);
    let maxW = 0;
    for (const n of layerNodes) maxW = Math.max(maxW, dims.get(n.id).w);

    let y = PAD;
    for (const n of layerNodes) {
      const d = dims.get(n.id);
      pos.set(n.id, { x: x + (maxW - d.w) / 2, y, w: d.w, h: d.h });
      y += d.h + V_GAP;
    }
    x += maxW + H_GAP;
  }

  // Compute SVG dimensions
  let svgW = 0, svgH = 0;
  for (const [, p] of pos) {
    svgW = Math.max(svgW, p.x + p.w + PAD);
    svgH = Math.max(svgH, p.y + p.h + PAD);
  }

  // Color by logic type
  function nodeColors(logicType) {
    if (logicType === 'configurable') return { fill: '#2d1b00', stroke: '#d29922' };
    if (logicType === 'probabilistic') return { fill: '#1b0d30', stroke: '#bc8cff' };
    return { fill: '#0d2818', stroke: '#3fb950' };
  }

  function wrapText(text, maxChars) {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if (cur && (cur.length + 1 + w.length) > maxChars) { lines.push(cur); cur = w; }
      else { cur = cur ? cur + ' ' + w : w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  let svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg" width="' + svgW + '" height="' + svgH + '">';
  svg += '<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#484f58"/></marker></defs>';

  // Draw edges first (behind nodes)
  for (const e of edges) {
    const from = pos.get(e.from);
    const to = pos.get(e.to);
    if (!from || !to) continue;

    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const midX = (x1 + x2) / 2;

    svg += '<path d="M' + x1 + ',' + y1 + ' C' + midX + ',' + y1 + ' ' + midX + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="#30363d" stroke-width="1.5" marker-end="url(#arrow)"/>';

    if (e.condition) {
      const lx = midX;
      const ly = (y1 + y2) / 2;
      const labelText = esc(e.condition);
      const labelW = Math.min(labelText.length * 6.5 + 16, 150);
      svg += '<rect x="' + (lx - labelW/2) + '" y="' + (ly - 10) + '" width="' + labelW + '" height="18" rx="4" fill="#161b22" stroke="#30363d" stroke-width="0.5"/>';
      svg += '<text x="' + lx + '" y="' + (ly + 3) + '" text-anchor="middle" fill="#8b949e" font-size="10" font-family="system-ui, sans-serif">' + labelText + '</text>';
    }
  }

  // Draw nodes
  for (const n of nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    const { x, y, w, h } = p;
    const colors = nodeColors(n.logic_type);

    if (n.type === 'start') {
      svg += '<circle cx="' + (x + w/2) + '" cy="' + (y + h/2) + '" r="22" fill="#0d2818" stroke="#3fb950" stroke-width="2"/>';
      svg += '<text x="' + (x + w/2) + '" y="' + (y + h/2 + 4) + '" text-anchor="middle" fill="#c9d1d9" font-size="11" font-weight="600" font-family="system-ui, sans-serif">' + esc(n.label) + '</text>';
    } else if (n.type === 'end') {
      svg += '<circle cx="' + (x + w/2) + '" cy="' + (y + h/2) + '" r="22" fill="#161b22" stroke="#484f58" stroke-width="3"/>';
      const endLines = wrapText(n.label, 14);
      const endStartY = y + h/2 - (endLines.length - 1) * 6 + 4;
      for (let i = 0; i < endLines.length; i++) {
        svg += '<text x="' + (x + w/2) + '" y="' + (endStartY + i * 12) + '" text-anchor="middle" fill="#8b949e" font-size="10" font-family="system-ui, sans-serif">' + esc(endLines[i]) + '</text>';
      }
    } else if (n.type === 'decision' || n.type === 'parallel_split' || n.type === 'parallel_join') {
      const cx = x + w/2, cy = y + h/2;
      const rx = w/2 - 4, ry = h/2 - 4;
      svg += '<polygon points="' + cx + ',' + (cy - ry) + ' ' + (cx + rx) + ',' + cy + ' ' + cx + ',' + (cy + ry) + ' ' + (cx - rx) + ',' + cy + '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1.5"/>';
      const decLines = wrapText(n.label, Math.floor(w / 8));
      const decStartY = cy - (decLines.length - 1) * 7 + 4;
      for (let i = 0; i < decLines.length; i++) {
        svg += '<text x="' + cx + '" y="' + (decStartY + i * 14) + '" text-anchor="middle" fill="#c9d1d9" font-size="11" font-weight="500" font-family="system-ui, sans-serif">' + esc(decLines[i]) + '</text>';
      }
    } else {
      // Task node
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" ry="8" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1.5"/>';
      const label = n.label || n.id;
      const charsPerLine = Math.floor((w - 30) / 7);
      const labelLines = wrapText(label, charsPerLine);
      const callsText = Array.isArray(n.calls) && n.calls.length > 0 ? 'calls: ' + n.calls.join(', ') : '';
      const callsLines = callsText ? wrapText(callsText, charsPerLine) : [];
      const totalH = labelLines.length * 14 + callsLines.length * 12 + (callsLines.length > 0 ? 6 : 0);
      const textY = y + (h - totalH) / 2 + 12;

      for (let i = 0; i < labelLines.length; i++) {
        svg += '<text x="' + (x + w/2) + '" y="' + (textY + i * 14) + '" text-anchor="middle" fill="#c9d1d9" font-size="11" font-weight="500" font-family="system-ui, sans-serif">' + esc(labelLines[i]) + '</text>';
      }
      if (callsLines.length > 0) {
        const callsY = textY + labelLines.length * 14 + 6;
        for (let i = 0; i < callsLines.length; i++) {
          svg += '<text x="' + (x + w/2) + '" y="' + (callsY + i * 12) + '" text-anchor="middle" fill="#8b949e" font-size="9" font-family="system-ui, sans-serif">' + esc(callsLines[i]) + '</text>';
        }
      }
    }
  }

  svg += '</svg>';
  return svg;
}

function renderFlow(flow) {
  if (!flow) return;
  document.getElementById('main-header').style.display = '';
  document.getElementById('flow-name').textContent = flow.name;
  document.getElementById('flow-desc').textContent = flow.description || '';

  const src = flow.source || {};
  document.getElementById('flow-meta').innerHTML =
    (src.file ? esc(src.file) + (src.line ? ':' + src.line : '') + (src['function'] ? ' &middot; ' + esc(src['function']) : '') : '') +
    ' &middot; status: ' + (flow.status || 'draft') +
    ' &middot; ' + (flow.tags || []).map(t => '<span class="tag tag-other">' + esc(t) + '</span>').join(' ');

  document.getElementById('empty-state').style.display = 'none';
  const content = document.getElementById('flow-content');
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.flex = '1';
  content.style.minHeight = '0';

  // Preserve zoom controls, replace only the SVG
  const canvas = document.getElementById('flow-canvas');
  const oldSvg = canvas.querySelector('svg');
  if (oldSvg) oldSvg.remove();
  canvas.insertAdjacentHTML('beforeend', renderSvgDiagram(flow));

  // Auto-fit after a tick to let layout settle
  scale = 1; panX = 0; panY = 0;
  setTimeout(fitToView, 50);
}

// ── Zoom & Pan ─────────────────────────────────────────────────────

let scale = 1;
let panX = 0, panY = 0;
let isPanning = false;
let startX = 0, startY = 0;

function updateTransform() {
  const svg = document.querySelector('#flow-canvas svg');
  if (!svg) return;
  svg.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
  document.getElementById('zoom-level').textContent = Math.round(scale * 100) + '%';
}

function resetZoom() {
  scale = 1; panX = 0; panY = 0;
  updateTransform();
}

function fitToView() {
  const svg = document.querySelector('#flow-canvas svg');
  const canvas = document.getElementById('flow-canvas');
  if (!svg || !canvas) return;
  const vb = svg.getAttribute('viewBox');
  if (!vb) return;
  const [,, svgW, svgH] = vb.split(' ').map(Number);
  const cw = canvas.clientWidth - 24;
  const ch = canvas.clientHeight - 24;
  scale = Math.min(cw / svgW, ch / svgH, 2);
  panX = Math.max(0, (cw - svgW * scale) / 2);
  panY = Math.max(0, (ch - svgH * scale) / 2);
  updateTransform();
}

document.getElementById('zoom-in').addEventListener('click', () => { scale = Math.min(scale * 1.25, 5); updateTransform(); });
document.getElementById('zoom-out').addEventListener('click', () => { scale = Math.max(scale / 1.25, 0.1); updateTransform(); });
document.getElementById('zoom-reset').addEventListener('click', resetZoom);
document.getElementById('zoom-fit').addEventListener('click', fitToView);

// Mouse wheel zoom (pinch-to-zoom on trackpad)
document.getElementById('flow-canvas').addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const rect = e.currentTarget.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const newScale = Math.min(Math.max(scale * delta, 0.1), 5);
  // Zoom toward cursor position
  panX = mx - (mx - panX) * (newScale / scale);
  panY = my - (my - panY) * (newScale / scale);
  scale = newScale;
  updateTransform();
}, { passive: false });

// Pan with mouse drag
document.getElementById('flow-canvas').addEventListener('mousedown', (e) => {
  if (e.target.closest('.zoom-controls')) return;
  isPanning = true; startX = e.clientX - panX; startY = e.clientY - panY;
});
document.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  panX = e.clientX - startX; panY = e.clientY - startY;
  updateTransform();
});
document.addEventListener('mouseup', () => { isPanning = false; });

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
  console.log(`  Serving ${readdirSync(flowsDir).filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml')).length} flows from ${flowsDir}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
