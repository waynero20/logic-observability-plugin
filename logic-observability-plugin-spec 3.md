# Logic Observability Plugin — Developer Build Recipe

**Owner:** GEIDI Pty Ltd
**Architect:** Atlas
**Status:** In development — 93% complete, 3 fixes remaining + BPMN quality verification
**Last updated:** 2026-04-09
**Target developer:** One fullstack developer building the plugin from scratch
**Estimated effort:** 7 milestones, serial execution
**Repo:** `github.com/geidi2/logic-observability-plugin` (main branch, commit 72599ce)

---

## Read This First

This document is a **complete recipe**. Follow it step by step. Every decision has been made. Every ambiguity has been resolved. You should not need to ask anyone questions — if something is unclear, check the [Decisions Pre-Made](#decisions-pre-made) section first.

**What you're building:** A Claude Code plugin that scans codebases, extracts business logic into structured YAML files, and generates interactive flowcharts + documentation from them.

**What you'll deliver:** A GitHub repo containing a Claude Code plugin with 6 slash commands, a standalone diagram viewer, and TypeScript extraction scripts.

---

## Table of Contents

1. [Build Status & Alignment Report](#build-status--alignment-report) **(start here)**
2. [Decisions Pre-Made](#decisions-pre-made)
3. [The IR Schema](#the-ir-schema)
4. [Milestone 1: Project Setup](#milestone-1-project-setup)
5. [Milestone 2: TypeScript Scanner](#milestone-2-typescript-scanner)
6. [Milestone 3: TypeScript Extractor](#milestone-3-typescript-extractor)
7. [Milestone 4: Generators](#milestone-4-generators)
8. [Milestone 5: Standalone Viewer](#milestone-5-standalone-viewer)
9. [Milestone 6: Claude Code Commands](#milestone-6-claude-code-commands)
10. [Milestone 7: Plugin Packaging](#milestone-7-plugin-packaging)
11. [Reference: Architecture Diagram](#reference-architecture-diagram)
12. [Reference: Existing Proof of Concept](#reference-existing-proof-of-concept)

---

## Build Status & Alignment Report

> **Last audited:** 2026-04-09 by Atlas (System Architect)
> **Source:** Alignment report from dev (commit 72599ce) cross-referenced against this spec

### Dashboard

| Milestone | Status | Completion | Blocking issues |
|---|---|---|---|
| **M1: Project Setup** | Done | 95% | `agents/` directory missing (minor) |
| **M2: TypeScript Scanner** | Done | 95% | Optional `.scan-result.json` not implemented (spec says optional) |
| **M3: TypeScript Extractor** | Done | 100% | None |
| **M4: Generators** | Done | 100% | BPMN quality unverified (see below) |
| **M5: Standalone Viewer** | Done | 90% | Search input is non-functional |
| **M6: Claude Code Commands** | Done | 100% | None |
| **M7: Plugin Packaging** | Partial | 70% | README.md missing |
| **Overall** | | **93%** | **3 fixes + 1 verification before shipping** |

### What's Aligned (matches spec exactly)

**Scanner (M2):**
- All 5 AI call detection patterns implemented
- All 7 categories with first-match-wins priority order
- `ScanResult` and `ScanItem` interfaces match spec
- `--json` and `--check` flags work
- Project type detection (TS, Dart, Python, Go, unknown) works
- Pretty table output for human reading
- Skip logic for node_modules, test files, declaration files

**Extractor (M3):**
- Full AST walking with ts-morph
- Function calls → task nodes, if/else → decision nodes, switch → per-case edges
- Logic type classification (deterministic / configurable / probabilistic) works
- code_ref set as file:line for every node
- Tracer span matching works
- Schema validation runs on output before writing
- Goes beyond spec: ternary expression handling, try/catch handling
- `status: draft` and `last_extracted` timestamp set correctly

**Generators (M4):**
- All 6 generators built and functional
- dagre layout: LR direction, ranksep 120, nodesep 60, correct node dimensions
- Color scheme matches spec exactly (green #22c55e, amber #f59e0b, purple #8b5cf6)
- XYFlow output includes all required node data fields
- BPMN uses two-step approach: bpmn-moddle → bpmn-auto-layout
- SVG renders all 4 node shapes correctly with color-coded borders
- HTML is self-contained with embedded SVG and legend
- Summary uses template-based natural language generation
- Element map builds forward + reverse indexes, only outputs when span/decision data exists
- generate-all.ts orchestrator runs all 6 sequentially with error reporting

**Commands (M6):**
- All 6 command markdown files exist and match spec
- Scan presents categorized table, asks dev to curate
- Extract uses automated (TS) or conversational (non-TS) mode
- Claude rewrites technical labels to business language in-conversation
- Validation runs after extraction
- Coverage check reports documented vs undocumented

**Viewer (M5, mostly):**
- Vite + React app with XYFlow, dagre, js-yaml
- Custom node components (TaskNode, GatewayNode, EventNode) with logic_type coloring
- NodePanel side panel with label, description, code_ref, logic_type badge, calls, reason_codes
- FlowSelector for switching between flows
- Filter by logic type works (dims non-matching nodes)
- CLI entry point with port 3200 + auto-fallback
- Dark theme with CSS variables matching generator output
- Empty directory handling ("No flows found")

### What's Misaligned (built differently from spec)

| Spec says | Implementation does | Assessment |
|---|---|---|
| 4 separate extractor files (`decision-finder.ts`, `call-tracer.ts`, `logic-classifier.ts`, `trace-matcher.ts`) | All logic consolidated into `extract-logic.ts` + `function-scanner.ts` | **Acceptable.** This is a design choice, not a gap. All functionality exists — just in fewer files. The spec's architecture diagram was illustrative, not prescriptive. |
| Version `0.1.0` in package.json | Version `1.0.0` | **Minor.** Change to `0.1.0` to indicate pre-release, or keep `1.0.0` if the dev considers it release-ready. Not blocking. |
| `marketplace.json` not mentioned in spec | File exists in git history (added/removed in commits) | **Neutral.** Extra file that doesn't hurt anything. Can keep or remove. |
| `docs/flows/validate.yaml` not in spec | Auto-extracted flow from the plugin's own validator (dogfooding) | **Good.** This is a positive signal — the dev tested the extractor on their own code. |

### What's Missing (needs to be done)

#### Fix 1: README.md (HIGH — blocking distribution)

**Plain English:** Without a README, nobody can install or use the plugin. This is the front door.

**What the README must contain:**
1. One-paragraph description of what the plugin does
2. Install command: `claude plugins marketplace add geidi2/logic-observability-plugin && claude plugins install logic-observability`
3. Screenshot or GIF of the viewer showing a diagram
4. Quick start — 3 commands:
   ```
   /scan-logic src/
   /extract-logic
   /view-flows
   ```
5. Full command reference — one section per command with description, usage, example output
6. Supported languages table: TypeScript (automated), all others (conversational)
7. IR schema quick reference — or link to `templates/schema.yaml`

**KPI:** A developer who has never seen the plugin reads the README, installs it, and completes the quick start without asking anyone for help.

#### Fix 2: Viewer search is non-functional (MEDIUM — UX issue)

**Plain English:** There's a search box in the viewer that does nothing when you type. This is confusing. Either make it work or remove it.

**Option A (preferred): Wire it up.**
- When the user types in the search box, filter or highlight nodes whose `label` contains the search text
- Non-matching nodes dim to 30% opacity
- Clear the search to restore all nodes

**Option B: Remove it.**
- Delete the search input from the viewer UI
- Add it back later when it works

**KPI:** Type "payment" in the search box → only nodes with "payment" in their label are highlighted. OR: search box does not exist in the UI.

#### Fix 3: `agents/` directory (LOW — structural)

**Plain English:** The spec's directory structure lists an `agents/` directory. It doesn't exist in the repo. Create it with at least a placeholder or the `logic-scanner.md` agent definition.

**What to do:** `mkdir agents && touch agents/.gitkeep` — or create `agents/logic-scanner.md` with a basic agent definition for the scanning workflow.

**KPI:** Directory exists. `plugin.json` references it if agent files are added.

### BPMN Quality Verification (REQUIRED before shipping)

> **Plain English:** The BPMN generator works — it produces XML files. But we haven't verified that the output is CORRECT (right logic) and BEAUTIFUL (clean layout). Before we ship, we need to see actual generated BPMN diagrams and verify they're usable.

#### What the dev must do

**Test 1: Simple flow**
1. Run `npx tsx scripts/generators/ir-to-bpmn.ts` on `templates/example-flow.yaml`
2. Open the output in [bpmn.io](https://demo.bpmn.io/) — paste the XML
3. Screenshot the result
4. Verify:
   - [ ] All nodes visible (not stacked at 0,0)
   - [ ] Labels readable on every node
   - [ ] Edges connect correctly (start → validate → check → fulfill/notify → end)
   - [ ] Decision gateway shows both outgoing paths clearly
   - [ ] No overlapping nodes
   - [ ] Flow reads left-to-right

**Test 2: Complex flow**
1. Create or extract an IR file with 15+ nodes, 3+ decision gateways, and at least one parallel split
2. Generate BPMN from it
3. Open in bpmn.io
4. Screenshot the result
5. Verify:
   - [ ] Gateway fan-out is readable (branches don't squeeze together)
   - [ ] Edge crossings are minimal
   - [ ] Labels don't overlap
   - [ ] Parallel gateway (if any) shows fork and join correctly
   - [ ] Overall diagram is readable without zooming

**Test 3: XML validation**
```typescript
import BpmnModdle from 'bpmn-moddle';
const moddle = new BpmnModdle();
const { rootElement, warnings } = await moddle.fromXML(generatedXml);
console.log('Warnings:', warnings);
// Expected: empty array (zero warnings)
```

**Test 4: Camunda Modeler compatibility**
1. Download [Camunda Modeler](https://camunda.com/download/modeler/) (free)
2. Open the generated BPMN file
3. Verify it loads without errors
4. Verify layout matches what bpmn.io showed

**Send results to Atlas:** Screenshots from Test 1 + Test 2, validation output from Test 3, and Camunda Modeler confirmation from Test 4.

#### What happens if layout is bad

If `bpmn-auto-layout` produces overlapping nodes, unreadable labels, or squeezed gateway branches on the complex flow test:

**Option A: Adjust spacing parameters**
`bpmn-auto-layout` may accept configuration options. Try increasing spacing if possible.

**Option B: Post-process with elkjs**
Add `elkjs` as a dependency. Build a wrapper that:
1. Generates BPMN XML with bpmn-moddle (no DI)
2. Converts BPMN elements to an ELK graph
3. Runs ELK's layered algorithm with orthogonal routing
4. Converts ELK positions back to BPMN DI coordinates
5. Merges DI into the BPMN XML

This is more work but produces professional-quality layout with:
- Orthogonal (right-angle) edge routing
- Minimized edge crossings
- Symmetrical gateway fan-out
- Proper label positioning

**Decision rule:** Test with `bpmn-auto-layout` first. If the complex flow screenshots are readable, ship it. If they're not, add elkjs. Don't add elkjs preemptively.

### Logic Correctness Checks (verify during BPMN testing)

| Check | What to look for | Why it matters |
|---|---|---|
| **Parallel execution** | If the source code has `Promise.all()` or concurrent async operations, does the BPMN use `ParallelGateway` (fork/join)? Or does it model them as sequential tasks? | Sequential BPMN for parallel code is logically wrong |
| **Decision conditions on edges** | When a gateway has 2+ outgoing edges, do they have `condition` labels (e.g., "yes"/"no", "in stock"/"out of stock")? | Unlabeled gateway edges are meaningless — you can't tell which path is which |
| **Error end events** | If a flow has error termination paths, does the BPMN use `ErrorEndEvent` or just regular `EndEvent`? | BPMN has specific error event types. Using regular ends for errors is semantically incorrect |
| **Start/end count** | Does each BPMN process have exactly one `StartEvent`? Are all terminal paths connected to an `EndEvent`? | Multiple starts or dangling paths are invalid BPMN |
| **Gateway balance** | Every split gateway should eventually have a matching merge/join gateway (or terminate). Are gateway pairs balanced? | Unbalanced gateways produce ambiguous execution semantics |

### What's NOT in Spec (dev added — keep or remove?)

| Extra feature | Assessment | Recommendation |
|---|---|---|
| `marketplace.json` in git history | Not in spec, may have been experimental | **Remove** if not needed. If Claude Code plugin system requires it, **keep**. |
| `docs/flows/validate.yaml` (dogfooding artifact) | Dev extracted IR from their own validator code | **Keep** — good test artifact, shows the extractor works on real code |
| Ternary expression handling in extractor | Goes beyond spec which only mentions if/else and switch | **Keep** — strictly better than spec minimum |

### Known Issue: BPMN XML Files Not Being Created

> **Reported:** 2026-04-09 — when testing `/generate-all`, no `.bpmn` files appear in the output directory. The generator may exist in code but is not producing output.

**The dev must investigate and fix this. Check these things in order:**

| # | What to check | How | What it means if it fails |
|---|---|---|---|
| 1 | Does `scripts/generators/ir-to-bpmn.ts` exist? | `ls scripts/generators/ir-to-bpmn.ts` | Generator was never written — build it per Milestone 4 Step 4.2 |
| 2 | Does `generate-all.ts` include the BPMN generator? | Read `generate-all.ts`, check if it calls `ir-to-bpmn` | Generator exists but orchestrator skips it — add it to the list |
| 3 | Does the BPMN generator run without errors? | `npx tsx scripts/generators/ir-to-bpmn.ts` — run it directly, read stdout/stderr | If it errors, fix the error. Common issues: bpmn-moddle import fails (check package installed), bpmn-auto-layout import fails (check package installed), IR files not found (check path) |
| 4 | Does `bpmn-moddle` import correctly? | Add `console.log('bpmn-moddle loaded')` at the top of the generator | ESM/CJS mismatch — bpmn-moddle may need `import BpmnModdle from 'bpmn-moddle'` or `const { default: BpmnModdle } = await import('bpmn-moddle')` depending on module system |
| 5 | Does `bpmn-auto-layout` import correctly? | Same test — `console.log('bpmn-auto-layout loaded')` | Same ESM/CJS issue. Try: `import { layoutProcess } from 'bpmn-auto-layout'` or dynamic import |
| 6 | Does it write to the right directory? | Check the output path in the script — should be `docs/flows/generated/<flow-id>.bpmn` | Writing to wrong path, or `docs/flows/generated/` doesn't exist (add `mkdirSync` with `recursive: true`) |
| 7 | Is the error being swallowed? | Check for `try/catch` blocks that catch errors silently. Add `console.error` in every catch block | Generator runs, fails internally, but reports success because the error is caught and ignored |
| 8 | Are there IR files to generate from? | `ls docs/flows/*.yaml` | No input files — run `/extract-logic` first, or manually place `templates/example-flow.yaml` in `docs/flows/` |

**Most likely cause:** Either the generator isn't in the orchestrator list, or it errors silently on import (ESM/CJS mismatch with bpmn-moddle or bpmn-auto-layout). The fix is usually a one-line import change.

**After fixing, verify:**
```bash
# Run BPMN generator directly
npx tsx scripts/generators/ir-to-bpmn.ts

# Check output exists
ls docs/flows/generated/*.bpmn

# Validate output
# Paste contents into https://demo.bpmn.io/ — should render with layout
```

---

### Next Steps (in order)

```
1. BPMN generator fix           ← Diagnose why no .bpmn files are created. Fix it. This is blocking.
2. README.md                    ← Write it. Blocking distribution.
3. BPMN quality verification    ← Run 4 tests, send screenshots to Atlas.
4. Viewer search                ← Wire it up or remove it.
5. agents/ directory            ← Create with placeholder or agent definition.
6. Atlas reviews BPMN results   ← Atlas decides if layout quality is acceptable.
7. Cross-project test           ← Install on a different project, run full workflow.
8. Ship                         ← Plugin is ready for distribution.
```

### Acceptance Gate (when is it DONE?)

The plugin ships when ALL of these pass:

| # | Check | Who verifies |
|---|---|---|
| 1 | **BPMN generator produces .bpmn files** — `npx tsx scripts/generators/ir-to-bpmn.ts` creates files in `docs/flows/generated/` | Dev |
| 2 | **BPMN simple flow renders correctly** in bpmn.io — screenshot provided showing nodes with layout, labels readable, edges connected | Atlas |
| 3 | **BPMN complex flow renders readably** in bpmn.io — screenshot of 15+ node diagram, no overlaps, gateway branches spread, labels visible | Atlas |
| 4 | **BPMN XML validates** with zero warnings in bpmn-moddle | Dev (automated) |
| 5 | **BPMN opens in Camunda Modeler** without errors | Dev |
| 6 | **README.md exists** with all 7 required sections | Atlas |
| 7 | **Viewer search works** OR search input removed | Atlas |
| 8 | **Full workflow** (`/scan-logic` → `/extract-logic` → `/generate-all` → view BPMN + viewer) works on a project the dev has never seen | Dev + Atlas |
| 9 | **Generated .bpmn file count matches IR file count** — one .bpmn per .yaml | Dev (automated) |
| 10 | A developer who wasn't involved installs and uses the plugin from the README alone | Atlas observes |

---

## Decisions Pre-Made

Every question you might have, answered upfront.

### Language & Runtime

| Question | Answer |
|---|---|
| What language are the scripts written in? | **TypeScript**, compiled with `tsx` (not `ts-node` — tsx is faster and requires zero config). Install as devDependency. |
| What Node version? | **20 LTS** or higher |
| What package manager? | **npm** (not yarn, not pnpm) |
| Module system? | **ESM** (`"type": "module"` in package.json, `"module": "ESNext"` in tsconfig) |

### Key Dependencies (exact versions)

| Package | Version | Why | Install command |
|---|---|---|---|
| `ts-morph` | `^24.0.0` | TypeScript AST analysis — the core extraction engine | `npm i -D ts-morph` |
| `js-yaml` | `^4.1.0` | Parse and write YAML IR files | `npm i -D js-yaml` |
| `@types/js-yaml` | `^4.0.9` | TypeScript types for js-yaml | `npm i -D @types/js-yaml` |
| `tsx` | `^4.19.0` | Run TypeScript scripts directly (faster than ts-node, zero config) | `npm i -D tsx` |
| `bpmn-moddle` | `^10.0.0` | Generate BPMN XML from IR | `npm i -D bpmn-moddle` |
| `bpmn-auto-layout` | `^1.3.0` | Automatic BPMN DI layout — adds coordinates to BPMN XML | `npm i -D bpmn-auto-layout` |
| `@dagrejs/dagre` | `^2.0.0` | Automatic graph layout for XYFlow diagrams and HTML/SVG exports | `npm i -D @dagrejs/dagre` |
| `@xyflow/react` | `^12.0.0` | Interactive diagram rendering (for viewer) | In viewer/ subdirectory only |
| `vite` | `^6.0.0` | Build tool for standalone viewer | In viewer/ subdirectory only |
| `react` | `^19.0.0` | UI framework for viewer | In viewer/ subdirectory only |
| `react-dom` | `^19.0.0` | React DOM rendering | In viewer/ subdirectory only |

**Do NOT install:** Tree-sitter, elkjs, Semgrep, CodeQL, any HuggingFace models. These are not needed.

### File & Directory Conventions

| Question | Answer |
|---|---|
| Where do IR files go in the target project? | `docs/flows/` directory at project root |
| IR file naming? | `<flow-id>.yaml` — kebab-case, e.g., `satisfaction-engine.yaml`, `message-routing.yaml` |
| How to derive flow ID from a function? | Use the module path: `src/engine/satisfaction.ts` → `engine-satisfaction`. If the function is a clear named flow (like `handleMessage`), use that: `handle-message` |
| Generator output directory? | `docs/flows/generated/` — all generated files go here, separate from source IR |
| Script naming? | kebab-case TypeScript files: `scan-logic.ts`, `ir-to-xyflow.ts` |

### How Scanner → Extractor Handoff Works

| Question | Answer |
|---|---|
| How does the curated list pass from `/scan-logic` to `/extract-logic`? | **It doesn't persist to a file.** Both commands are Claude Code slash commands — they run in the same Claude conversation. Claude remembers the scan results and the developer's curation choices. When the developer types `/extract-logic`, Claude uses the approved list from the earlier `/scan-logic` in the same session. If the developer starts a new session, they run `/scan-logic` again. |
| What if the developer wants to save the scan for later? | The scanner can optionally output JSON to `docs/flows/.scan-result.json`. But this is a convenience, not a requirement. |

### How Claude Code Commands Work

| Question | Answer |
|---|---|
| What is a Claude Code command? | A markdown file in the plugin's `commands/` directory. When the developer types `/command-name`, Claude reads the markdown file as instructions for what to do. |
| Can commands run scripts? | Yes. The command's markdown tells Claude to run a shell command (e.g., `npx tsx scripts/scan-logic.ts src/`). Claude executes it via the Bash tool and reads the output. |
| Does Claude do the labeling? | Yes. The extractor produces draft IR with technical labels (function names). Claude reads the draft in-conversation and rewrites labels in business language. No separate API call — Claude IS the labeler. |
| How does conversational mode work for non-TypeScript? | The command's markdown tells Claude: "No automated extractor available for this language. Read the source files, identify functions, decision points, and API calls, and write IR YAML manually by asking the developer questions." Claude does this conversationally. |

### Layout Algorithm (dagre configuration)

| Question | Answer |
|---|---|
| Layout direction? | **Left-to-right** (`rankdir: 'LR'`). Flows read horizontally. |
| Node spacing? | `ranksep: 120` (horizontal gap between ranks), `nodesep: 60` (vertical gap between nodes in same rank) |
| Node dimensions for dagre? | Tasks: `width: 180, height: 50`. Gateways: `width: 60, height: 60`. Events: `width: 40, height: 40`. |
| Edge routing? | dagre handles this automatically. Use `pathType: 'smoothstep'` in XYFlow for smooth edges. |

### HTML/SVG Export Rendering

| Question | Answer |
|---|---|
| How to render diagrams without a browser? | Use dagre for layout (same as XYFlow generator), then **build SVG manually** from positioned nodes/edges. No headless browser needed. SVG is just XML — construct it with string templates or a lightweight SVG builder. |
| SVG shapes? | Task = `<rect rx="8">` with label `<text>`. Decision = `<polygon>` rotated 45°. Start = `<circle>`. End = `<circle>` with double stroke. |
| HTML wrapper? | HTML export = the SVG embedded in a minimal HTML page with inline CSS. Self-contained, no external scripts or styles. |
| Color scheme for exports? | Dark background (`#0f0f0f`), white text (`#e0e0e0`), indigo accent (`#6366f1`), green for deterministic (`#22c55e`), yellow for configurable (`#f59e0b`), purple for probabilistic (`#8b5cf6`). |

### BPMN Generation Details

| Question | Answer |
|---|---|
| bpmn-moddle API? | Use `BpmnModdle.create()` to build the model, then `BpmnModdle.toXML()` to serialize. See starter code in Milestone 4. |
| How to add DI (diagram layout)? | **Do NOT build DI coordinates manually.** Use `bpmn-auto-layout` — it takes BPMN XML without DI and returns BPMN XML with DI coordinates added. One function call. See starter code in Milestone 4. |
| Why not dagre for BPMN? | dagre outputs generic x/y positions. BPMN DI needs specific shape bounds, waypoints for edges, and label positions in BPMN's own XML format. `bpmn-auto-layout` handles all of this natively — it's from the same team that makes bpmn.io and Camunda Modeler. |
| What about elkjs for better layout? | elkjs produces professional-quality orthogonal routing, but requires a custom wrapper to convert ELK output to BPMN DI format. Not needed for v1. `bpmn-auto-layout` is good enough. Add elkjs later if stakeholders need presentation-quality diagrams. |
| Node type mapping? | IR `task` → `bpmn:ServiceTask`. IR `decision` → `bpmn:ExclusiveGateway`. IR `start` → `bpmn:StartEvent`. IR `end` → `bpmn:EndEvent`. IR `parallel_split`/`parallel_join` → `bpmn:ParallelGateway`. |
| Layout limitations? | `bpmn-auto-layout` handles single-participant processes well. It does NOT support swim lanes, collaboration diagrams, or expanded sub-processes. These are not needed for v1 — all our flows are single-process. |

### Standalone Viewer Details

| Question | Answer |
|---|---|
| How to make it npx-runnable? | Add a `bin` entry in `viewer/package.json` pointing to a CLI script that starts the Vite dev server. Publish to npm as `@geidi/logic-viewer`. |
| What port? | Default `3200`. If taken, increment: 3201, 3202, etc. Use Vite's built-in port detection. |
| How does the viewer load IR files? | The CLI reads YAML files from the directory argument and serves them via a local API endpoint. The React app fetches from `localhost:3200/api/flows`. |
| Viewer theme? | Dark, neutral, clean. CSS variables. No glassmorphic effects, no blur, no project-specific styling. See color scheme above. |
| Viewer node components? | Three custom XYFlow node types: `TaskNode` (rounded rect), `GatewayNode` (diamond), `EventNode` (circle). Color-coded by `logic_type`: green border = deterministic, yellow = configurable, purple = probabilistic. |

### Plugin Packaging

| Question | Answer |
|---|---|
| Plugin format? | Claude Code plugin — `plugin.json` + markdown agent/command files. See [Milestone 7](#milestone-7-plugin-packaging). |
| Where to publish? | Private GitHub repo: `github.com/geidi2/logic-observability-plugin` |
| How do users install? | First: `claude plugins marketplace add geidi2/logic-observability-plugin`. Then: `claude plugins install logic-observability`. |
| What ships with the plugin? | Command markdown files + scripts + templates + viewer. All in one repo. |
| Do scripts need a build step? | No. Scripts run directly via `npx tsx`. No compilation step. |

### Error Handling

| Question | Answer |
|---|---|
| What if ts-morph can't parse a file? | Log a warning (`Skipping <file>: parse error`), continue scanning other files. Never crash on a single unparseable file. |
| What if a function has no branches? | Still include it if it's in an "include" category (entry point, AI call, etc.). Branch count = 0 is valid. |
| What if no TypeScript project is detected? | Fall back to conversational mode. The command's markdown handles this — tells Claude to read files manually. |
| What if `docs/flows/` doesn't exist? | Create it. The generator should `mkdirSync('docs/flows/generated', { recursive: true })` before writing. |
| What if the IR references a function that was deleted? | `/check-coverage` should report it as "stale IR — code not found at <code_ref>". Don't auto-delete — let the developer decide. |

---

## The IR Schema

This is the single most important thing in the plugin. Everything downstream reads from it. Get this right.

### Complete schema with every field explained

```yaml
# ═══════════════════════════════════════════════════
# IR Flow File — this describes one logical flow
# in the system (e.g., one API handler, one decision
# pipeline, one scheduled job)
# ═══════════════════════════════════════════════════

# ─── REQUIRED METADATA ───

flow: satisfaction-engine
  # Machine-readable ID. Kebab-case. Unique across the project.
  # Derived from module path or function name.
  # Examples: "message-routing", "daily-report", "user-onboarding"

version: 1
  # Schema version number. Always 1 for now.
  # Increment if the schema changes in a breaking way.

title: Satisfaction Engine
  # Human-readable title. Title case. Used in viewer tabs
  # and documentation headings. Under 40 characters.

description: >
  How the system decides if a standup answer is good enough —
  checks for length, filler words, vague phrases, and asks
  the AI if all heuristics pass.
  # Plain English, 1-3 sentences. Written for non-developers.
  # This appears in flow summaries and viewer tooltips.

service: vox-standup-bot
  # Project/repo name. Identifies which system this flow belongs to.

module: src/vox/standup/satisfaction
  # Code directory or file path (without extension).
  # Tells the developer where to find the source code.

status: draft
  # "draft" = auto-extracted, not yet developer-reviewed
  # "verified" = developer has reviewed and approved the labels/structure
  # Only "verified" IR files are considered trustworthy.

last_extracted: 2026-04-08T10:30:00Z
  # ISO 8601 timestamp. When the extractor last ran on this flow.
  # Updated automatically by the extractor.

# ─── NODES ───
# Each node is one step, decision, or event in the flow.
# Order in the file doesn't matter — edges define the flow order.

nodes:
  - id: start
      # Unique within this flow. Snake_case.
      # Convention: "start" for entry, "end" or "end_<reason>" for exits.
    type: start
      # One of: task, decision, start, end, parallel_split, parallel_join
    label: "Start"
      # Business-friendly label. Under 10 words.
      # Should be understandable by a non-developer.
      # Bad:  "Call isVagueHeuristic() with params"
      # Good: "Check for vague language"

  - id: check_override
    type: decision
    label: "Full answer override?"
    code_ref: src/vox/standup/satisfaction.ts:45
      # OPTIONAL. Exact file:line in the source code.
      # Only present if the extractor found a specific code location.
      # Lets developers click through from the diagram to the code.
    logic_type: deterministic
      # REQUIRED for task and decision nodes. One of:
      #   deterministic  — pure code logic, same input = same output
      #   configurable   — reads from config/settings, behavior changes without code change
      #   probabilistic  — calls an AI/LLM, output varies
    description: >
      Checks if the user's answer contains a full override phrase
      (e.g., "I already covered that") that bypasses all other checks.
      # OPTIONAL. Plain English explanation. 1-2 sentences.
    calls: []
      # OPTIONAL. List of functions/APIs this step calls.
      # Examples: ["anthropic.messages.create", "db.from('users').select()"]
    span_name: null
      # OPTIONAL. Tracer span name, if the project has runtime tracing.
      # Example: "vox.standup.satisfaction.score"
      # Set to null if no tracing exists.
    decision_point: isSatisfied.fullAnswerOverride
      # OPTIONAL. Decision logger key, if the project has decision logging.
      # Set to null if no decision logging exists.
    reason_codes:
      - SAT_FULL_ANSWER_OVERRIDE
      # OPTIONAL. List of outcome codes for this decision.
      # Empty array if not applicable.

  - id: llm_check
    type: task
    label: "Ask AI: is this answer sufficient?"
    code_ref: src/vox/standup/satisfaction.ts:112
    logic_type: probabilistic
    description: >
      Sends the question and answer to Claude with scoring instructions.
      The AI rates the answer's relevance and completeness.
    calls:
      - anthropic.messages.create
    span_name: vox.standup.satisfaction.llmCheck
    decision_point: isSatisfied.llmCheck
    reason_codes:
      - SAT_LLM_SATISFIED
      - SAT_LLM_NOT_SATISFIED
    model: claude-3-sonnet
      # OPTIONAL. Only for probabilistic nodes. Which AI model is used.
    confidence_range: [0.0, 1.0]
      # OPTIONAL. Only for probabilistic nodes. Expected confidence range.

  - id: end_satisfied
    type: end
    label: "Answer accepted"

# ─── EDGES ───
# Each edge connects two nodes. Order defines nothing — use
# entry_point and edges to trace the flow.

edges:
  - from: start
      # Source node ID. Must exist in nodes list.
    to: check_override
      # Target node ID. Must exist in nodes list.

  - from: check_override
    to: end_override
    condition: "yes"
      # OPTIONAL. Human-readable condition for this path.
      # Only meaningful for edges leaving a decision node.
    reason_code: SAT_FULL_ANSWER_OVERRIDE
      # OPTIONAL. Which reason code triggers this path.

  - from: check_override
    to: check_word_count
    condition: "no"

# ─── FLOW-LEVEL METADATA ───

entry_point: start
  # REQUIRED. The ID of the first node in the flow.

exit_points:
  - end_override
  - end_satisfied
  - end_not_satisfied
  # REQUIRED. List of all terminal node IDs.

estimated_duration_ms: 200-2000
  # OPTIONAL. Typical execution time range. String, not number.

error_modes:
  - "LLM timeout after 30s"
  - "Empty answer (0 words)"
  # OPTIONAL. Known failure scenarios. Helps with debugging.
```

### Validation Rules (implement these in `scripts/validate-ir.ts`)

| Rule | Check | Error message |
|---|---|---|
| `flow` required | Field exists and is a non-empty string | "Missing required field: flow" |
| `title` required | Field exists and is a non-empty string | "Missing required field: title" |
| `description` required | Field exists and is a non-empty string | "Missing required field: description" |
| `status` valid | Value is "draft" or "verified" | "Invalid status: must be 'draft' or 'verified'" |
| `nodes` non-empty | Array has at least 1 node | "Flow must have at least one node" |
| `edges` present | Array exists (can be empty for single-node flows) | "Missing edges array" |
| Node `id` unique | No duplicate IDs within a flow | "Duplicate node ID: <id>" |
| Node `type` valid | One of: task, decision, start, end, parallel_split, parallel_join | "Invalid node type: <type>" |
| Node `label` required | Non-empty string | "Node <id> missing label" |
| Node `logic_type` required for task/decision | Present and valid for task/decision nodes | "Node <id> missing logic_type" |
| Node `logic_type` valid | One of: deterministic, configurable, probabilistic | "Invalid logic_type: <type>" |
| Edge `from` exists | References a valid node ID | "Edge references unknown node: <from>" |
| Edge `to` exists | References a valid node ID | "Edge references unknown node: <to>" |
| `entry_point` exists | References a valid node ID | "entry_point references unknown node: <id>" |
| `exit_points` exist | Each references a valid node ID | "exit_point references unknown node: <id>" |
| No orphan nodes | Every node is reachable from entry_point via edges (warning, not error) | "Warning: node <id> is unreachable" |

---

## Milestone 1: Project Setup

**What you'll have at the end:** A repo with the right structure, dependencies installed, IR schema documented, an example IR file, and a working schema validator.

### Step 1.1: Create the repo

```bash
mkdir logic-observability-plugin
cd logic-observability-plugin
git init
npm init -y
```

### Step 1.2: Set up package.json

Replace the generated `package.json` with:

```json
{
  "name": "@geidi/logic-observability",
  "version": "0.1.0",
  "description": "Scan code, extract business logic, generate interactive flowcharts and AI context",
  "type": "module",
  "scripts": {
    "scan": "tsx scripts/scan-logic.ts",
    "extract": "tsx scripts/extract-logic.ts",
    "generate": "tsx scripts/generate-all.ts",
    "generate:xyflow": "tsx scripts/generators/ir-to-xyflow.ts",
    "generate:bpmn": "tsx scripts/generators/ir-to-bpmn.ts",
    "generate:html": "tsx scripts/generators/ir-to-html.ts",
    "generate:svg": "tsx scripts/generators/ir-to-svg.ts",
    "generate:summary": "tsx scripts/generators/ir-to-summary.ts",
    "generate:element-map": "tsx scripts/generators/ir-to-element-map.ts",
    "validate": "tsx scripts/validate-ir.ts",
    "check": "tsx scripts/scan-logic.ts --check"
  },
  "devDependencies": {}
}
```

### Step 1.3: Install dependencies

```bash
npm i -D typescript tsx ts-morph js-yaml @types/js-yaml @types/node bpmn-moddle bpmn-auto-layout @dagrejs/dagre
```

### Step 1.4: Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["scripts/**/*.ts"],
  "exclude": ["node_modules", "viewer"]
}
```

### Step 1.5: Create directory structure

```bash
mkdir -p scripts/extractors
mkdir -p scripts/generators
mkdir -p commands
mkdir -p agents
mkdir -p templates
mkdir -p viewer
```

Your repo should look like:

```
logic-observability-plugin/
  package.json
  tsconfig.json
  scripts/
    extractors/        (empty, will fill in M2-M3)
    generators/        (empty, will fill in M4)
  commands/            (empty, will fill in M6)
  agents/              (empty, will fill in M6)
  templates/           (will add schema + example in next steps)
  viewer/              (empty, will fill in M5)
```

### Step 1.6: Create the schema reference file

Create `templates/schema.yaml` — copy the IR schema from [The IR Schema](#the-ir-schema) section above. This file is documentation, not executable. It's the reference for what valid IR looks like.

### Step 1.7: Create an example IR file

Create `templates/example-flow.yaml`:

```yaml
flow: order-processing
version: 1
title: Order Processing
description: >
  Handles incoming orders — validates payment, checks inventory,
  and either fulfills the order or notifies the customer of issues.
service: example-project
module: src/orders/processor
status: verified
last_extracted: 2026-04-08T00:00:00Z

nodes:
  - id: start
    type: start
    label: "Order received"

  - id: validate_payment
    type: task
    label: "Validate payment details"
    code_ref: src/orders/processor.ts:23
    logic_type: deterministic
    description: Checks card number format, expiry, and CVV.
    calls: []
    reason_codes: []

  - id: check_inventory
    type: decision
    label: "Item in stock?"
    code_ref: src/orders/processor.ts:45
    logic_type: configurable
    description: Reads inventory levels from database.
    calls: [db.from('inventory').select()]
    reason_codes:
      - IN_STOCK
      - OUT_OF_STOCK

  - id: fulfill
    type: task
    label: "Fulfill order"
    code_ref: src/orders/processor.ts:67
    logic_type: deterministic
    calls: [shipping.createLabel]
    reason_codes: []

  - id: notify_out_of_stock
    type: task
    label: "Notify customer: out of stock"
    code_ref: src/orders/processor.ts:82
    logic_type: deterministic
    calls: [email.send]
    reason_codes: []

  - id: end_fulfilled
    type: end
    label: "Order shipped"

  - id: end_out_of_stock
    type: end
    label: "Customer notified"

edges:
  - from: start
    to: validate_payment

  - from: validate_payment
    to: check_inventory

  - from: check_inventory
    to: fulfill
    condition: "in stock"
    reason_code: IN_STOCK

  - from: check_inventory
    to: notify_out_of_stock
    condition: "out of stock"
    reason_code: OUT_OF_STOCK

  - from: fulfill
    to: end_fulfilled

  - from: notify_out_of_stock
    to: end_out_of_stock

entry_point: start
exit_points:
  - end_fulfilled
  - end_out_of_stock
estimated_duration_ms: 100-500
error_modes:
  - "Payment gateway timeout"
  - "Inventory DB unavailable"
```

### Step 1.8: Build the schema validator

Create `scripts/validate-ir.ts`:

```typescript
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

const VALID_NODE_TYPES = ['task', 'decision', 'start', 'end', 'parallel_split', 'parallel_join'];
const VALID_LOGIC_TYPES = ['deterministic', 'configurable', 'probabilistic'];
const VALID_STATUSES = ['draft', 'verified'];

interface IRNode {
  id: string;
  type: string;
  label: string;
  logic_type?: string;
  [key: string]: unknown;
}

interface IREdge {
  from: string;
  to: string;
  condition?: string;
  [key: string]: unknown;
}

interface IRFlow {
  flow: string;
  version: number;
  title: string;
  description: string;
  status: string;
  nodes: IRNode[];
  edges: IREdge[];
  entry_point: string;
  exit_points: string[];
  [key: string]: unknown;
}

function validate(filePath: string): string[] {
  const errors: string[] = [];
  const warnings: string[] = [];

  let ir: IRFlow;
  try {
    const content = readFileSync(filePath, 'utf-8');
    ir = yaml.load(content) as IRFlow;
  } catch (e) {
    return [`FATAL: Cannot parse ${filePath}: ${(e as Error).message}`];
  }

  // Required metadata
  if (!ir.flow) errors.push('Missing required field: flow');
  if (!ir.title) errors.push('Missing required field: title');
  if (!ir.description) errors.push('Missing required field: description');
  if (ir.status && !VALID_STATUSES.includes(ir.status)) {
    errors.push(`Invalid status "${ir.status}": must be "draft" or "verified"`);
  }

  // Nodes
  if (!ir.nodes || ir.nodes.length === 0) {
    errors.push('Flow must have at least one node');
    return errors;
  }

  const nodeIds = new Set<string>();
  for (const node of ir.nodes) {
    if (!node.id) { errors.push('Node missing id'); continue; }
    if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: "${node.id}"`);
    nodeIds.add(node.id);

    if (!node.label) errors.push(`Node "${node.id}" missing label`);
    if (!VALID_NODE_TYPES.includes(node.type)) {
      errors.push(`Node "${node.id}" has invalid type "${node.type}"`);
    }
    if (['task', 'decision'].includes(node.type)) {
      if (!node.logic_type) {
        errors.push(`Node "${node.id}" (${node.type}) missing logic_type`);
      } else if (!VALID_LOGIC_TYPES.includes(node.logic_type)) {
        errors.push(`Node "${node.id}" has invalid logic_type "${node.logic_type}"`);
      }
    }
  }

  // Edges
  if (!ir.edges) errors.push('Missing edges array');
  else {
    for (const edge of ir.edges) {
      if (!nodeIds.has(edge.from)) errors.push(`Edge references unknown source node: "${edge.from}"`);
      if (!nodeIds.has(edge.to)) errors.push(`Edge references unknown target node: "${edge.to}"`);
    }
  }

  // Entry/exit points
  if (ir.entry_point && !nodeIds.has(ir.entry_point)) {
    errors.push(`entry_point references unknown node: "${ir.entry_point}"`);
  }
  if (ir.exit_points) {
    for (const ep of ir.exit_points) {
      if (!nodeIds.has(ep)) errors.push(`exit_point references unknown node: "${ep}"`);
    }
  }

  // Reachability check (warning only)
  if (ir.entry_point && ir.edges) {
    const reachable = new Set<string>();
    const queue = [ir.entry_point];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const edge of ir.edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }
    for (const node of ir.nodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`Warning: node "${node.id}" is unreachable from entry_point`);
      }
    }
  }

  return [...errors, ...warnings];
}

// CLI entry point
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: tsx scripts/validate-ir.ts <path-to-yaml>');
  process.exit(1);
}

const issues = validate(filePath);
if (issues.length === 0) {
  console.log(`✓ ${filePath} is valid`);
  process.exit(0);
} else {
  const errors = issues.filter(i => !i.startsWith('Warning:'));
  const warnings = issues.filter(i => i.startsWith('Warning:'));
  if (errors.length > 0) {
    console.error(`✗ ${filePath} has ${errors.length} error(s):`);
    errors.forEach(e => console.error(`  - ${e}`));
  }
  if (warnings.length > 0) {
    warnings.forEach(w => console.warn(`  ${w}`));
  }
  process.exit(errors.length > 0 ? 1 : 0);
}
```

### Step 1.9: Test it

```bash
# Should pass:
npx tsx scripts/validate-ir.ts templates/example-flow.yaml

# Should fail (test with a broken file):
echo "flow: test" > /tmp/bad.yaml
npx tsx scripts/validate-ir.ts /tmp/bad.yaml
```

### Milestone 1 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| Dependencies install | `npm install` | No errors |
| Schema reference exists | `cat templates/schema.yaml` | All fields documented |
| Example IR is valid YAML | `npx tsx scripts/validate-ir.ts templates/example-flow.yaml` | Exit code 0, prints "✓ valid" |
| Validator catches errors | Feed it a file with a duplicate node ID | Reports the duplicate |
| Validator catches missing fields | Feed it a file with no `title` | Reports "Missing required field: title" |
| Directory structure matches spec | `find . -type f -name "*.ts" -o -name "*.yaml" -o -name "*.json" | sort` | All expected files exist |

**Gate:** Validator passes on good input, fails on bad input. Move on.

---

### Milestone 2: TypeScript Scanner

**What you'll have at the end:** A script that reads any TypeScript project and outputs a categorized JSON list of all functions worth documenting.

### Step 2.1: Build function-scanner.ts

Create `scripts/extractors/function-scanner.ts`.

This script uses ts-morph to find all functions in a TypeScript project.

**Starter code for ts-morph project initialization:**

```typescript
import { Project, SyntaxKind, FunctionDeclaration, MethodDeclaration, Node } from 'ts-morph';

export function createProject(tsconfigPath: string): Project {
  return new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });
}

// If no tsconfig, add files manually:
export function createProjectFromDir(dir: string): Project {
  const project = new Project({ compilerOptions: { allowJs: true } });
  project.addSourceFilesAtPaths(`${dir}/**/*.ts`);
  project.addSourceFilesAtPaths(`${dir}/**/*.tsx`);
  return project;
}
```

**How to find all exported functions:**

```typescript
for (const sourceFile of project.getSourceFiles()) {
  // Skip node_modules, test files, and declaration files
  const filePath = sourceFile.getFilePath();
  if (filePath.includes('node_modules') || filePath.includes('.test.') || filePath.includes('.spec.') || filePath.endsWith('.d.ts')) {
    continue;
  }

  // Get exported functions
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported()) {
      // Process function
    }
  }

  // Get class methods
  for (const cls of sourceFile.getClasses()) {
    if (cls.isExported()) {
      for (const method of cls.getMethods()) {
        // Process method
      }
    }
  }

  // Get exported arrow functions (const x = () => {})
  for (const varStmt of sourceFile.getVariableStatements()) {
    if (varStmt.isExported()) {
      for (const decl of varStmt.getDeclarations()) {
        const initializer = decl.getInitializer();
        if (initializer && Node.isArrowFunction(initializer)) {
          // Process arrow function
        }
      }
    }
  }
}
```

**How to count branches:**

```typescript
function countBranches(node: Node): number {
  let count = 0;
  count += node.getDescendantsOfKind(SyntaxKind.IfStatement).length;
  count += node.getDescendantsOfKind(SyntaxKind.SwitchStatement).length;
  count += node.getDescendantsOfKind(SyntaxKind.ConditionalExpression).length; // ternary
  // Count case clauses within switch statements
  count += node.getDescendantsOfKind(SyntaxKind.CaseClause).length;
  return count;
}
```

**How to find call expressions:**

```typescript
function findCalls(node: Node): string[] {
  const calls: string[] = [];
  for (const callExpr of node.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = callExpr.getExpression();
    calls.push(expr.getText());
  }
  return [...new Set(calls)]; // deduplicate
}
```

**How to detect AI calls:**

```typescript
const AI_CALL_PATTERNS = [
  'anthropic.messages.create',
  'anthropic.completions.create',
  'openai.chat.completions.create',
  'openai.completions.create',
  '.messages.create',  // catches aliased anthropic clients
];

function isAICall(callText: string): boolean {
  return AI_CALL_PATTERNS.some(pattern => callText.includes(pattern));
}
```

**How to detect DB operations:**

```typescript
const DB_WRITE_PATTERNS = ['.insert(', '.update(', '.delete(', '.upsert('];
const DB_READ_PATTERNS = ['.from(', '.select(', '.rpc('];

function isDBWrite(callText: string): boolean {
  return DB_WRITE_PATTERNS.some(p => callText.includes(p));
}
```

Build the full scanner by combining these patterns. Output should match the `ScanResult` interface:

```typescript
export interface ScanResult {
  projectType: 'typescript' | 'dart' | 'python' | 'go' | 'unknown';
  totalFiles: number;
  totalFunctions: number;
  categories: {
    entryPoints: ScanItem[];
    decisionTrees: ScanItem[];
    aiCalls: ScanItem[];
    externalCalls: ScanItem[];
    dataMutations: ScanItem[];
    utilities: ScanItem[];
    alreadyDocumented: ScanItem[];
  };
  recommended: number;
  skipped: number;
}

export interface ScanItem {
  id: number;
  name: string;
  filePath: string;       // file:line format
  category: string;
  branchCount: number;
  calls: string[];
  hasTracer: boolean;
  hasDecisionLog: boolean;
  recommended: boolean;
  existingIR: string | null;
}
```

**Categorization rules (apply in this order — first match wins):**

1. Has a call matching AI_CALL_PATTERNS → `aiCalls`
2. Has a call matching DB_WRITE_PATTERNS → `dataMutations`
3. Has a `@Get`, `@Post`, `@Put`, `@Delete` decorator, OR function name starts with `handle` → `entryPoints`
4. branchCount >= 3 → `decisionTrees`
5. Has a call to a node_modules package (external) → `externalCalls`
6. Otherwise → `utilities` (recommended = false)

### Step 2.2: Build scan-logic.ts orchestrator

Create `scripts/scan-logic.ts`:

1. Detect project type (check for `tsconfig.json` in target dir or project root)
2. If TypeScript: create ts-morph Project, run function-scanner, categorize, output JSON
3. If `--check` flag: compare scan results against existing IR files in `docs/flows/`, report new/stale/missing
4. Print summary to stdout

**CLI usage:**
```bash
npx tsx scripts/scan-logic.ts src/          # scan a directory
npx tsx scripts/scan-logic.ts src/ --json   # output raw JSON (for command consumption)
npx tsx scripts/scan-logic.ts src/ --check  # compare against existing IR
```

### Milestone 2 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| Scanner runs on a real TS project | `npx tsx scripts/scan-logic.ts <path-to-ts-project>/src/` | Exit 0, outputs categorized list |
| All exported functions found | Manually count exports in 3 random files, compare against scanner output | Scanner found them all |
| Categories are accurate | Spot-check 10 items across categories | >80% correctly categorized |
| Branch counts are right | Pick 3 functions with known branches, compare | Counts match |
| Scan completes in <10 seconds | Time it: `time npx tsx scripts/scan-logic.ts src/` | <10s for 100 files |
| JSON output is valid | `npx tsx scripts/scan-logic.ts src/ --json | python -m json.tool` | Valid JSON, matches ScanResult interface |
| `--check` mode works | Add an IR file, delete the function it references, run `--check` | Reports "stale IR" |

**Gate:** Run on a real TypeScript project (use the Vox standup bot `src/` directory or any 50+ file TS project). If >80% of categorizations are correct by spot-checking, proceed.

---

### Milestone 3: TypeScript Extractor

**What you'll have at the end:** A script that takes a list of function names and produces draft IR YAML files with technical labels.

### Step 3.1: Build extract-logic.ts

Create `scripts/extract-logic.ts`.

This script takes the curated function list (from scanner output) and produces IR YAML for each.

**Input:** JSON file or stdin with list of approved ScanItems
**Output:** YAML files written to `docs/flows/`

**For each approved function:**

1. Use ts-morph to load the function's AST
2. Walk the function body sequentially:
   - Each function call → IR `task` node
   - Each if/else → IR `decision` node with two edges (one per branch)
   - Each switch → IR `decision` node with edges per case
   - Each try/catch → wrap in a task node (don't model the error path separately unless it's business logic)
3. Create `start` and `end` nodes
4. Connect with edges following code flow order
5. Set `code_ref` for each node: `${sourceFile.getFilePath()}:${node.getStartLineNumber()}`
6. Classify `logic_type`:
   - Calls an AI API → `probabilistic`
   - Reads from config/settings/env → `configurable`
   - Everything else → `deterministic`
7. Match to tracer spans if found (check for `tracer.span('...')` calls)
8. Set labels to technical names (function names, variable names) — Claude will rewrite these in the command step
9. Set `status: draft`
10. Run schema validator on output before writing

**Complexity guidance:**
- For functions with <3 branches: model as a linear sequence of task nodes
- For functions with 3-10 branches: model each branch as a decision + edges
- For functions with >10 branches: group into sub-flows if possible, or flatten (over-extraction is better than under-extraction — Claude and the developer can simplify later)

### Milestone 3 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| Extractor produces valid YAML | Run validator on every output file | All pass validation |
| Node count is reasonable | Extract a function with 6 branches — expect 8-12 nodes | Not fewer than branches, not 10x more |
| Edges connect correctly | Manually trace edges on 2 extracted flows | All `from`/`to` reference valid nodes |
| Logic types are correct | Check 5 nodes: AI calls = probabilistic, pure logic = deterministic | All correct |
| code_ref is accurate | Click 5 random code_ref values | All point to correct file:line |
| Accuracy ≥70% | Compare auto-extracted IR against manually-written expected IR for one function | ≥70% of nodes correctly identified |

**Gate:** Extract one known function. Compare output against what you'd write by hand. If ≥70% of the nodes and edges are correct, proceed. If <70%, analyze what's being missed and fix.

---

### Milestone 4: Generators

**What you'll have at the end:** 6 scripts that read IR YAML and produce: XYFlow definitions, BPMN XML, element map, HTML, SVG, and plain-text summaries.

### Step 4.1: Build ir-to-xyflow.ts

**Starter code for dagre layout:**

```typescript
import dagre from '@dagrejs/dagre';

function layoutNodes(nodes: IRNode[], edges: IREdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 120, nodesep: 60 });

  // Set node dimensions based on type
  for (const node of nodes) {
    const dims = node.type === 'task' ? { width: 180, height: 50 }
      : ['decision', 'parallel_split', 'parallel_join'].includes(node.type) ? { width: 60, height: 60 }
      : { width: 40, height: 40 }; // start/end events
    g.setNode(node.id, dims);
  }

  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  // Extract positions
  return nodes.map(node => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } };
  });
}
```

Output a TypeScript file that exports the XYFlow nodes and edges:

```typescript
// Generated output format:
export const flows = {
  'order-processing': {
    nodes: [
      { id: 'start', type: 'startEvent', position: { x: 0, y: 120 }, data: { label: 'Order received', ... } },
      // ... more nodes
    ],
    edges: [
      { id: 'e-start-validate', source: 'start', target: 'validate_payment', type: 'smoothstep' },
      // ... more edges
    ],
  },
};
```

### Step 4.2: Build ir-to-bpmn.ts

**Two-step process:** (1) Build BPMN XML with bpmn-moddle (no layout), (2) Add DI layout with bpmn-auto-layout.

**Step A — Build BPMN XML with bpmn-moddle:**

```typescript
import BpmnModdle from 'bpmn-moddle';

const moddle = new BpmnModdle();

// Create a process
const process = moddle.create('bpmn:Process', { id: 'Process_1', isExecutable: true });

// Add a start event
const startEvent = moddle.create('bpmn:StartEvent', { id: 'start', name: 'Start' });
process.get('flowElements').push(startEvent);

// Add a service task
const task = moddle.create('bpmn:ServiceTask', { id: 'validate', name: 'Validate payment' });
process.get('flowElements').push(task);

// Add a sequence flow
const flow = moddle.create('bpmn:SequenceFlow', { id: 'f1', sourceRef: startEvent, targetRef: task });
process.get('flowElements').push(flow);

// Node type mapping from IR:
// IR task         → moddle.create('bpmn:ServiceTask', ...)
// IR decision     → moddle.create('bpmn:ExclusiveGateway', ...)
// IR start        → moddle.create('bpmn:StartEvent', ...)
// IR end          → moddle.create('bpmn:EndEvent', ...)
// IR parallel_*   → moddle.create('bpmn:ParallelGateway', ...)

// Create the definitions wrapper
const definitions = moddle.create('bpmn:Definitions', {
  id: 'Definitions_1',
  targetNamespace: 'http://geidi.com/logic-observability',
  rootElements: [process],
});

// Serialize to XML (NO DI coordinates yet)
const { xml: xmlWithoutLayout } = await moddle.toXML(definitions, { format: true });
```

**Step B — Add DI layout with bpmn-auto-layout:**

```typescript
import { layoutProcess } from 'bpmn-auto-layout';

// Takes BPMN XML without DI → returns BPMN XML with DI coordinates added
// This adds <bpmndi:BPMNDiagram>, <bpmndi:BPMNShape> with bounds,
// and <bpmndi:BPMNEdge> with waypoints — automatically.
const xmlWithLayout = await layoutProcess(xmlWithoutLayout);

// Write to file. This XML opens correctly in Camunda Modeler / bpmn.io.
writeFileSync(`docs/flows/generated/${flowId}.bpmn`, xmlWithLayout);
```

**That's it.** No manual coordinate math. No dagre-to-DI conversion. `bpmn-auto-layout` handles the entire DI generation — shape bounds, edge waypoints, label positions. The output opens cleanly in Camunda Modeler.

**Note:** `bpmn-auto-layout` handles single-participant processes. It does NOT support swim lanes or collaboration diagrams. All our flows are single-process, so this is fine for v1.

### Step 4.3: Build ir-to-html.ts and ir-to-svg.ts

Build SVG manually from dagre-positioned nodes:

```typescript
function nodeToSVG(node: PositionedNode): string {
  const { x, y } = node.position;
  const fill = node.logic_type === 'probabilistic' ? '#8b5cf6'
    : node.logic_type === 'configurable' ? '#f59e0b'
    : '#22c55e';

  switch (node.type) {
    case 'task':
      return `<g>
        <rect x="${x}" y="${y}" width="180" height="50" rx="8" fill="#1a1a1a" stroke="${fill}" stroke-width="2"/>
        <text x="${x + 90}" y="${y + 30}" text-anchor="middle" fill="#e0e0e0" font-size="12">${escapeXml(node.label)}</text>
      </g>`;
    case 'decision':
      return `<g>
        <rect x="${x}" y="${y}" width="60" height="60" rx="4" fill="#1a1a1a" stroke="${fill}" stroke-width="2" transform="rotate(45,${x + 30},${y + 30})"/>
        <text x="${x + 30}" y="${y + 34}" text-anchor="middle" fill="#e0e0e0" font-size="10">${escapeXml(node.label)}</text>
      </g>`;
    case 'start':
      return `<circle cx="${x + 20}" cy="${y + 20}" r="18" fill="none" stroke="${fill}" stroke-width="2"/>`;
    case 'end':
      return `<circle cx="${x + 20}" cy="${y + 20}" r="18" fill="none" stroke="${fill}" stroke-width="3"/>`;
    default:
      return '';
  }
}
```

HTML export wraps SVG in a minimal page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{flow.title}</title>
  <style>
    body { margin: 0; background: #0f0f0f; display: flex; justify-content: center; padding: 40px; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  {svgContent}
</body>
</html>
```

### Step 4.4: Build ir-to-element-map.ts

Reads `span_name` and `decision_point` from each IR node. Builds forward + reverse indexes. Only produces output if any node has a non-null `span_name` or `decision_point`.

### Step 4.5: Build ir-to-summary.ts

For each flow, generate a paragraph from node labels:

```
"The {flow.title} starts with {first_node.label}. It then {node2.label}.
When {decision.label}, it either {yes_branch.label} or {no_branch.label}.
Finally, it {last_node.label}."
```

Keep it simple. This is a template-based generator, not an LLM call.

### Step 4.6: Build generate-all.ts

Orchestrator that runs all generators:

```typescript
// scripts/generate-all.ts
import { execSync } from 'child_process';

const generators = ['xyflow', 'bpmn', 'html', 'svg', 'summary', 'element-map'];
for (const gen of generators) {
  console.log(`Generating ${gen}...`);
  execSync(`npx tsx scripts/generators/ir-to-${gen}.ts`, { stdio: 'inherit' });
}
console.log('Done. All outputs in docs/flows/generated/');
```

### Milestone 4 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| XYFlow output valid | Generated TS file has no TypeScript errors. Node IDs unique. All edges reference existing nodes. | Passes `tsc --noEmit` |
| BPMN output valid | Parse with `bpmn-moddle` — no errors. Open in bpmn.io — diagram renders with proper layout (no stacking at 0,0, no overlapping nodes) | No parse errors, diagram visible with layout |
| HTML opens in browser | Open generated HTML in Chrome, Firefox, Safari | Diagram visible, no console errors |
| SVG renders | Open in any image viewer or browser | Nodes and edges visible, labels readable |
| Summary is readable | Read the generated paragraph | Makes sense to a non-developer |
| Element map correct (if applicable) | Forward + reverse indexes present. Spot-check 3 entries | Correct mappings |
| `npm run generate` works | Runs all 6 generators | All succeed, outputs in `docs/flows/generated/` |

**Gate:** Generate all outputs from the example IR file. Every format is valid and renders correctly. Move on.

---

### Milestone 5: Standalone Viewer

**What you'll have at the end:** `npx @geidi/logic-viewer docs/flows/` opens an interactive diagram in the browser.

### Step 5.1: Initialize viewer app

```bash
cd viewer
npm create vite@latest . -- --template react-ts
npm install @xyflow/react @dagrejs/dagre js-yaml @types/js-yaml
```

### Step 5.2: Build the viewer

The viewer needs these components:

1. **App.tsx** — loads IR files via API, manages selected flow state
2. **FlowSelector.tsx** — dropdown/tabs to switch between flows
3. **FlowCanvas.tsx** — XYFlow with custom node types, minimap, controls
4. **TaskNode.tsx** — rounded rect, color-coded by logic_type
5. **GatewayNode.tsx** — diamond, color-coded
6. **EventNode.tsx** — circle
7. **NodePanel.tsx** — click a node, side panel with label, description, code_ref, logic_type, calls, reason_codes

**Color scheme for logic types:**
- Deterministic: `#22c55e` (green) border
- Configurable: `#f59e0b` (amber) border
- Probabilistic: `#8b5cf6` (purple) border

**Logic type badges in node panel:**
- Deterministic: green badge "Rule-based"
- Configurable: amber badge "Config-driven"
- Probabilistic: purple badge "AI-powered"

### Step 5.3: Build the CLI entry point

Create `viewer/cli.ts`:

```typescript
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createServer } from 'vite';
import yaml from 'js-yaml';

const flowsDir = process.argv[2];
if (!flowsDir) {
  console.error('Usage: logic-viewer <path-to-flows-directory>');
  process.exit(1);
}

// Load all YAML files
const files = readdirSync(flowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
if (files.length === 0) {
  console.error(`No YAML files found in ${flowsDir}`);
  process.exit(1);
}

const flows = files.map(f => {
  const content = readFileSync(join(flowsDir, f), 'utf-8');
  return yaml.load(content);
});

// Start Vite dev server with flows data injected
// (inject via a virtual module or write to a temp file that the app reads)
```

### Step 5.4: Package for npx

In `viewer/package.json`:
```json
{
  "name": "@geidi/logic-viewer",
  "version": "0.1.0",
  "bin": {
    "logic-viewer": "./cli.js"
  }
}
```

### Milestone 5 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| Viewer opens | `npx tsx viewer/cli.ts templates/` | Browser opens, diagram visible |
| Flows load | All YAML files in directory appear as selectable flows | Every file shows up |
| Nodes are interactive | Click a node | Panel opens with correct details |
| Logic type colors | Deterministic = green, configurable = amber, probabilistic = purple | Visually verified |
| Filter works | "Show only AI calls" | Only probabilistic nodes visible |
| Search works | Type a label fragment | Matching nodes highlighted |
| Empty directory | Point at empty dir | "No flows found" message |
| Loads in <3 seconds | First paint time | Diagram visible within 3s |

**Gate:** Give the viewer to someone who's never seen it. They have 2 minutes. Can they: find a flow, click a node, see its details? If yes, proceed.

---

### Milestone 6: Claude Code Commands

**What you'll have at the end:** Six working slash commands that wrap the scripts from previous milestones.

### Step 6.1: Write command definitions

Create each command file as markdown in `commands/`:

**`commands/scan-logic.md`:**
```markdown
---
description: Scan codebase for extractable business logic
---

Scan the specified directory and present a categorized list of functions that contain business logic.

## What to do

1. Check if target path has a `tsconfig.json` (TypeScript project).
   - If YES: run `npx tsx scripts/scan-logic.ts <target-path> --json` and parse the JSON output.
   - If NO: read source files in the target path yourself. Identify functions, decision points, and API calls conversationally. Categorize them using the rules below.

2. Present results as a categorized table with these columns: #, Function, File:Line, Type, Branches, Extract?

3. Group into categories:
   - ENTRY POINTS — handlers, controllers, webhook receivers, cron jobs → default: Include
   - DECISION TREES — functions with 3+ branches → default: Include
   - AI CALLS — functions calling LLM APIs (Anthropic, OpenAI, etc.) → default: Include
   - EXTERNAL CALLS — functions calling third-party APIs → default: Include
   - DATA MUTATIONS — functions with database writes → default: Include
   - UTILITIES — simple helpers, formatters, validators → default: Skip
   - ALREADY DOCUMENTED — functions with existing IR files → show status

4. Show summary: "X found, Y recommended, Z skipped, W already documented"

5. Ask the developer: "Review the list above. Tell me which items to remove or add, then run /extract-logic to generate IR for the approved items."

6. Remember the approved list for when /extract-logic is called.
```

**`commands/extract-logic.md`:**
```markdown
---
description: Extract approved logic into IR YAML files
---

Extract business logic for the functions approved in the previous /scan-logic step.

## What to do

1. For each approved function from the scan results:

   a. If TypeScript project: run `npx tsx scripts/extract-logic.ts <function-file:line> --json` and parse the output.
   b. If non-TypeScript: read the source file yourself, identify the control flow (sequential steps, decisions, API calls), and structure it as IR YAML.

2. For each extracted flow, rewrite the technical labels in business language:
   - Bad:  "call isVagueHeuristic() with params wordCount, fillerRatio"
   - Good: "Check for vague language"
   - Labels should be under 10 words and understandable by non-developers.

3. Classify each node's logic_type:
   - Calls an LLM/AI API → probabilistic
   - Reads from config/settings/database config → configurable
   - Pure code logic → deterministic

4. Show the developer each flow's IR and ask: "Does this look right? Any labels to adjust?"

5. After developer approval, write each IR file to `docs/flows/<flow-id>.yaml` with `status: draft`.

6. Run validation: `npx tsx scripts/validate-ir.ts docs/flows/<flow-id>.yaml`

7. Report: "Extracted X flows. Files written to docs/flows/. Run /generate-all to produce diagrams."
```

**`commands/generate-all.md`:**
```markdown
---
description: Generate all outputs from IR YAML files
---

Run `npx tsx scripts/generate-all.ts` to produce all outputs from the IR files in docs/flows/.

Report what was generated: XYFlow definitions, BPMN XML, HTML exports, SVG exports, summaries, and element map (if applicable).
```

**`commands/check-coverage.md`:**
```markdown
---
description: Check what's documented vs what isn't
---

Run `npx tsx scripts/scan-logic.ts <src-path> --check` to compare the codebase against existing IR files.

Present the results:
- Functions with IR entries vs without
- Stale IR (references code that no longer exists)
- Draft vs verified status
- Coverage percentage
```

**`commands/export-flows.md`:**
```markdown
---
description: Export flows as static HTML or SVG
---

Generate static exports from IR files.

If the developer specifies --format html: run `npx tsx scripts/generators/ir-to-html.ts`
If the developer specifies --format svg: run `npx tsx scripts/generators/ir-to-svg.ts`
If no format specified, generate both.

Report where the files were written.
```

**`commands/view-flows.md`:**
```markdown
---
description: Open the interactive flow viewer
---

Launch the standalone viewer: `npx tsx viewer/cli.ts docs/flows/`

Tell the developer it's available at http://localhost:3200.
```

### Milestone 6 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| `/scan-logic` works | Type it in Claude Code on a TypeScript project | Categorized table appears, developer can curate |
| `/extract-logic` works | Type it after scanning | Claude produces IR with business labels |
| Labels are business-friendly | Show 5 labels to a non-developer | They understand 4/5 |
| `/generate-all` works | Type it | All 6 outputs generated |
| `/check-coverage` works | Type it | Reports documented vs undocumented |
| `/export-flows` works | Type it | HTML/SVG files created |
| `/view-flows` works | Type it | Viewer opens in browser |

**Gate:** Someone who didn't build the plugin does the full workflow in Claude Code: `/scan-logic src/` → curate → `/extract-logic` → `/generate-all` → `/view-flows`. They complete it without reading source code. If they get stuck, improve the command prompts and retest.

---

### Milestone 7: Plugin Packaging

**What you'll have at the end:** A GitHub repo anyone can install as a Claude Code plugin.

### Step 7.1: Create plugin.json

```json
{
  "name": "logic-observability",
  "version": "1.0.0",
  "description": "Scan code, extract business logic, generate interactive flowcharts and AI context",
  "commands": [
    "commands/scan-logic.md",
    "commands/extract-logic.md",
    "commands/generate-all.md",
    "commands/check-coverage.md",
    "commands/export-flows.md",
    "commands/view-flows.md"
  ]
}
```

### Step 7.2: Write README.md

Include:
- One-paragraph description
- Install command
- Screenshot or GIF of the viewer
- Quick start (3 commands: scan, extract, view)
- Full command reference
- Supported languages (TypeScript automated, all others conversational)

### Step 7.3: Clean up paths

Ensure all scripts use relative paths and don't reference any project-specific locations. Test by cloning the repo to a different directory and running the scripts.

### Step 7.4: Push to GitHub

```bash
git add -A
git commit -m "feat: logic observability plugin v1.0.0"
git remote add origin https://github.com/geidi2/logic-observability-plugin.git
git push -u origin main
```

### Step 7.5: Test installation

On a completely different project (NOT the one you developed on):

```bash
cd ~/some-other-typescript-project
claude plugins marketplace add geidi2/logic-observability-plugin
claude plugins install logic-observability
claude  # start Claude Code
# type /scan-logic src/
```

### Milestone 7 KPIs

| Check | How to verify | Pass criteria |
|---|---|---|
| Plugin installs | `claude plugins install logic-observability` | Success message |
| Commands appear | Type `/scan` in Claude Code | `/scan-logic` auto-completes |
| Works on fresh project | Full workflow on a project the dev has never seen | Scan → extract → generate → view works |
| Non-TypeScript fallback | Try on a Python or Dart project | Claude offers conversational extraction |
| Uninstall is clean | `claude plugins uninstall logic-observability` | Commands disappear |
| README is sufficient | New developer reads README, installs, uses plugin | No questions needed |

**Gate:** A developer who wasn't involved installs the plugin on their own project and completes the full workflow without help.

---

## Reference: Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Claude Code Commands (what the developer types)         │
│  /scan-logic  /extract-logic  /generate-all  /view-flows │
└────────────┬─────────────────────────────┬───────────────┘
             │                             │
┌────────────▼────────────┐  ┌─────────────▼──────────────┐
│  Scanner + Extractor    │  │  Generators                │
│  (code → IR YAML)       │  │  (IR YAML → outputs)       │
│                         │  │                            │
│  scan-logic.ts          │  │  ir-to-xyflow.ts           │
│  extract-logic.ts       │  │  ir-to-bpmn.ts             │
│  extractors/            │  │  ir-to-html.ts             │
│    function-scanner.ts  │  │  ir-to-svg.ts              │
│    decision-finder.ts   │  │  ir-to-summary.ts          │
│    call-tracer.ts       │  │  ir-to-element-map.ts      │
│    logic-classifier.ts  │  │                            │
│    trace-matcher.ts     │  │  Standalone Viewer          │
│                         │  │  viewer/                    │
└────────────┬────────────┘  └─────────────┬──────────────┘
             │                             │
             ▼                             ▼
┌──────────────────────────────────────────────────────────┐
│                    IR YAML Files                         │
│              docs/flows/*.yaml                           │
│            (single source of truth)                      │
└──────────────────────────────────────────────────────────┘
```

---

## Reference: Existing Proof of Concept

The Vox Standup Bot project has a working proof of concept called "Flow Map" that demonstrates the viewer, runtime trace overlay, and element mapping. Study these files for patterns:

| File | What it demonstrates |
|---|---|
| `admin-ui/src/lib/bpmn/bpmn-types.ts` | Type system for diagram rendering |
| `admin-ui/src/lib/bpmn/diagram-definitions.ts` | Hand-written XYFlow node/edge arrays (what `ir-to-xyflow.ts` should produce) |
| `admin-ui/src/lib/bpmn/element-map.ts` | Auto-generated trace-to-element mapping |
| `admin-ui/src/hooks/useBpmnDiagramState.ts` | State resolution (trace events → element visual states) |
| `admin-ui/src/components/bpmn/BpmnDiagramCanvas.tsx` | XYFlow wrapper with custom node types |
| `scripts/generate-element-map.cjs` | Regex-based code scanning (simpler predecessor to ts-morph extractor) |

Study these for patterns but build the plugin standalone — don't depend on Vox code.

---

*Questions? Contact Atlas (System Architect) or Rey (Project Lead). But read the [Decisions Pre-Made](#decisions-pre-made) section first — your question is probably already answered.*
