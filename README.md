# Logic Observability Plugin

A Claude Code plugin that scans codebases, extracts business logic into structured YAML files (IR), and generates interactive flowcharts, BPMN diagrams, and documentation from them. It turns implicit code logic into visible, reviewable artifacts that non-developers can understand.

## Install

```bash
claude plugins marketplace add geidi2/logic-observability-plugin
claude plugins install logic-observability
```

## Quick Start

```
/scan-logic src/          # Scan your codebase for extractable business logic
/extract-logic            # Extract approved functions into IR YAML files
/generate-all             # Generate flowcharts, BPMN, HTML, SVG, and summaries
/view-flows               # Open the interactive diagram viewer
```

## Commands

### `/scan-logic`

Scan a directory and present a categorized list of functions that contain business logic.

**Usage:** `/scan-logic src/`

Categories detected:
- **Entry Points** -- handlers, controllers, webhook receivers, cron jobs
- **Decision Trees** -- functions with 3+ branches
- **AI Calls** -- functions calling LLM APIs (Anthropic, OpenAI, etc.)
- **External Calls** -- functions calling third-party APIs
- **Data Mutations** -- functions with database writes
- **Utilities** -- simple helpers (skipped by default)
- **Already Documented** -- functions with existing IR files

After scanning, curate the list by telling Claude which items to include or exclude.

### `/extract-logic`

Extract the approved functions from the previous scan into IR YAML files.

For TypeScript projects, extraction is automated via AST analysis. For all other languages, Claude reads the source files and writes IR conversationally. Labels are rewritten from technical names to business-friendly language.

Output: YAML files in `docs/flows/` with `status: draft`.

### `/generate-all`

Generate all output formats from IR YAML files in `docs/flows/`:

| Format | Output | Use case |
|---|---|---|
| XYFlow JSON | `*.xyflow.json` | Interactive viewer data |
| BPMN XML | `*.bpmn` | Open in bpmn.io or Camunda Modeler |
| HTML | `*.html` | Self-contained diagram page |
| SVG | `*.svg` | Static diagram image |
| Markdown summary | `*.summary.md` | Plain English flow description |
| Element map | `element-map.json` | Links tracer spans to diagram nodes |

All outputs written to `docs/flows/generated/`.

### `/check-coverage`

Compare your codebase against existing IR files. Reports:
- Functions with IR entries vs without
- Stale IR (references code that no longer exists)
- Draft vs verified status
- Coverage percentage

### `/export-flows`

Generate static exports. Supports `--format html`, `--format svg`, or both (default).

### `/view-flows`

Launch the interactive diagram viewer at `http://localhost:3200`. Features:
- Switch between flows via tabs
- Click nodes to see details (description, code reference, logic type, calls, reason codes)
- Filter by logic type (deterministic, configurable, AI-powered)
- Search nodes by label
- Minimap and zoom controls

## Supported Languages

| Language | Extraction mode | What happens |
|---|---|---|
| **TypeScript** | Automated | AST analysis via ts-morph -- functions, branches, calls extracted automatically |
| **All others** | Conversational | Claude reads source files and writes IR YAML by asking the developer questions |

## IR Schema

Each flow is a YAML file in `docs/flows/` describing one logical flow (API handler, decision pipeline, scheduled job, etc.).

```yaml
flow: order-processing        # Unique kebab-case ID
version: 1                    # Schema version
title: Order Processing       # Human-readable title
description: >                # Plain English, 1-3 sentences
  Handles incoming orders -- validates payment, checks inventory,
  and either fulfills the order or notifies the customer.
service: my-project            # Project/repo name
module: src/orders/processor   # Code path
status: draft                  # draft | verified

nodes:
  - id: start
    type: start                # start | task | decision | end | parallel_split | parallel_join
    label: "Order received"
  - id: check_inventory
    type: decision
    label: "Item in stock?"
    logic_type: configurable   # deterministic | configurable | probabilistic
    code_ref: src/orders/processor.ts:45

edges:
  - from: start
    to: check_inventory

entry_point: start
exit_points: [end_fulfilled, end_out_of_stock]
```

Full schema reference: [`templates/schema.yaml`](templates/schema.yaml)

## Logic Types

Nodes are color-coded by how their logic works:

| Type | Color | Meaning |
|---|---|---|
| **Deterministic** | Green | Pure code logic -- same input always produces same output |
| **Configurable** | Amber | Reads from config/settings -- behavior changes without code changes |
| **Probabilistic** | Purple | Calls an AI/LLM -- output varies between runs |

## Requirements

- Node.js 20 LTS or higher
- npm
