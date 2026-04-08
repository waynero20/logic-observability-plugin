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

const flows = files.map(f => {
  const content = readFileSync(join(resolvedDir, f), 'utf-8');
  return yaml.load(content);
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
