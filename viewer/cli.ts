#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createServer } from 'vite';
import yaml from 'js-yaml';

const flowsDir = process.argv[2];
if (!flowsDir) {
  console.error('Usage: logic-viewer <path-to-flows-directory>');
  process.exit(1);
}

const resolvedDir = resolve(flowsDir);
if (!existsSync(resolvedDir)) {
  console.error(`Directory not found: ${resolvedDir}`);
  process.exit(1);
}

// Load all YAML files
const files = readdirSync(resolvedDir).filter(f =>
  (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.')
);

if (files.length === 0) {
  console.error(`No YAML files found in ${resolvedDir}`);
  process.exit(1);
}

// Normalize steps-format YAML into the nodes/edges IR format the viewer expects
function normalizeFlow(raw: any): any {
  // Already in IR format (has nodes/edges)
  if (raw.nodes && raw.edges) return raw;

  // Steps-format: convert to IR
  if (!raw.steps) return raw;

  const nodes: any[] = [];
  const edges: any[] = [];

  // Add start node
  nodes.push({ id: '__start', type: 'start', label: 'Start' });

  for (const step of raw.steps) {
    const hasOutcome = step.outcome && typeof step.outcome === 'object';
    const callsList = step.calls
      ? (typeof step.calls === 'string' ? step.calls.split(',').map((s: string) => s.trim()) : step.calls)
      : [];

    nodes.push({
      id: step.id,
      type: hasOutcome ? 'decision' : 'task',
      label: step.label || step.id,
      logic_type: step.logic_type || 'deterministic',
      calls: callsList.length > 0 ? callsList : undefined,
      description: step.description,
      code_ref: step.code_ref,
    });
  }

  // Add end node
  nodes.push({ id: '__end', type: 'end', label: 'End' });

  // Create sequential edges (start → first step → ... → last step → end)
  edges.push({ from: '__start', to: raw.steps[0].id });
  for (let i = 0; i < raw.steps.length - 1; i++) {
    edges.push({ from: raw.steps[i].id, to: raw.steps[i + 1].id });
  }
  edges.push({ from: raw.steps[raw.steps.length - 1].id, to: '__end' });

  return {
    flow: raw.id || raw.flow || 'unknown',
    version: raw.version || 1,
    title: raw.name || raw.title || raw.id || 'Untitled',
    description: raw.description || '',
    service: raw.service,
    module: raw.module,
    status: raw.status || 'draft',
    tags: raw.tags,
    source: raw.source,
    nodes,
    edges,
    entry_point: '__start',
    exit_points: ['__end'],
  };
}

const flows = files.map(f => {
  try {
    const content = readFileSync(join(resolvedDir, f), 'utf-8');
    const raw = yaml.load(content);
    return raw ? normalizeFlow(raw) : null;
  } catch (e) {
    console.warn(`Skipping ${f}: ${(e as Error).message}`);
    return null;
  }
}).filter(Boolean);

console.log(`Loaded ${flows.length} flow(s) from ${resolvedDir}`);

// Start Vite dev server with API plugin
const server = await createServer({
  root: import.meta.dirname,
  server: { port: 3200, strictPort: false },
  plugins: [
    {
      name: 'flows-api',
      configureServer(server) {
        server.middlewares.use('/api/flows', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(flows));
        });
      },
    },
  ],
});

await server.listen();
const info = server.config.server;
const port = server.httpServer?.address();
const actualPort = typeof port === 'object' && port ? port.port : 3200;

console.log(`\n  Logic Observer running at http://localhost:${actualPort}\n`);
console.log(`  Press Ctrl+C to stop.\n`);
