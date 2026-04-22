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

// Adapt various YAML formats into the nodes+edges IR format the viewer expects
function adaptFlow(raw: any): any {
  // Already in viewer IR format
  if (raw.flow && raw.edges) return raw;

  // Steps-format (has raw.steps array)
  if (raw.steps) {
    const nodes: any[] = [];
    const edges: any[] = [];

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

    nodes.push({ id: '__end', type: 'end', label: 'End' });

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
      status: raw.status || 'active',
      nodes,
      edges,
      entry_point: '__start',
      exit_points: ['__end'],
    };
  }

  // Nodes-with-next format (id, nodes[] with next/branches inline)
  if (raw.id && raw.nodes && !raw.edges) {
    const typeMap: Record<string, string> = {
      action: 'task',
      guard: 'decision',
      decision: 'decision',
      start: 'start',
      end: 'end',
    };

    const nodes: any[] = [];
    const edges: any[] = [];
    const entryPoint = raw.nodes[0]?.id || '';
    const exitPoints: string[] = [];

    for (const node of raw.nodes) {
      const viewerType = typeMap[node.type] || 'task';
      nodes.push({
        id: node.id,
        type: viewerType,
        label: node.label || node.id,
        logic_type: 'deterministic',
      });

      if (node.terminal) {
        exitPoints.push(node.id);
      }

      if (node.next) {
        edges.push({ from: node.id, to: node.next });
      }
      if (node.branches) {
        for (const branch of node.branches) {
          if (branch.next) {
            edges.push({ from: node.id, to: branch.next, condition: branch.condition });
          }
        }
      }
    }

    return {
      flow: raw.id,
      version: 1,
      title: raw.title || raw.id,
      description: raw.description || '',
      status: 'active',
      nodes,
      edges,
      entry_point: entryPoint,
      exit_points: exitPoints,
    };
  }

  return raw;
}

const flows = files.map(f => {
  try {
    const content = readFileSync(join(resolvedDir, f), 'utf-8');
    const raw = yaml.load(content);
    return raw ? adaptFlow(raw) : null;
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
const port = server.httpServer?.address();
const actualPort = typeof port === 'object' && port ? port.port : 3200;

console.log(`\n  Business Flow Viewer running at http://localhost:${actualPort}\n`);
console.log(`  Open this link in your browser to view your process flows.`);
console.log(`  Press Ctrl+C to stop.\n`);
