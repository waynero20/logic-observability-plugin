# Project Brief: System Logic Observability Layer

**Version:** 2.1
**Owner:** GEIDI Pty Ltd  
**Status:** Draft for review  
**Applies to:** All current and future GEIDI/JaB projects — TypeScript/NestJS backends and Flutter/Dart mobile applications

---

## Change Log

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-09 | Initial brief — problem statement, IR concept, ts-morph extractor, Mermaid rendering |
| 1.1 | 2026-04-09 | Added Dart/Flutter extractor (dart analyzer, Riverpod, GoRouter); replaced Mermaid with XyFlow as sole rendering layer |
| 2.0 | 2026-04-09 | Merged v1.1 brief + Nicko's implementation plan + OTEL enrichment model; added confidence types (static_only / runtime_only / static_plus_runtime); added design principles and APM drift warning; added Claude Code plugin / developer workflow; added Phase 0 (Flow Map); added CI drift detection; OTEL role clarified as enrichment not primary |
| 2.1 | 2026-04-09 | Added Related Initiatives section — documents relationship between Logic Observability Layer and MongoDB Migration Phase -1 (Data Intelligence Layer); clarifies overlap in OTEL and NestJS static analysis; flags ts-morph extractor should be built once to serve both initiatives |

---

## Problem Statement

AI-assisted development has fundamentally changed the volume of code being produced. Systems that once took months to build are now built in weeks. The consequence is that no single person — developer, architect, or AI — can hold the full picture of a running system in their head.

This creates two compounding problems:

1. **Non-developers cannot engage meaningfully** with system logic. Business decisions get made without full understanding of what the system actually does.

2. **AI tools reason about fragments, not systems.** When a developer asks an AI assistant for help, it sees one file or one service. The distributed logic — across services, config, and AI-driven behaviour — is invisible to it. The more code that gets generated, the worse this gets.

The result is an accelerating gap between what the system does, what humans believe it does, and what AI can reason about.

---

## Objective

Build a reusable **System Logic Observability Layer** that surfaces the business logic of any GEIDI/JaB system in a structured, queryable, human-readable form.

This layer serves three consumers simultaneously:

- **Business stakeholders** — can read and validate what the system does without needing to understand code
- **Developers** — have a shared reference point for discussion, onboarding, and design
- **AI assistants** — can be given structured system context to reason about the whole, not just fragments

---

## What This Is Not

This is not a monitoring or alerting system. OTEL covers runtime observability.  
This is not a code documentation generator. Comments and API docs are a separate concern.  
This is not a process execution engine. Logic is captured for understanding, not for running.  
This is not an APM tool. There are no dashboards, alerts, or metrics. It is a **logic understanding system**.

---

## Core Concept: The Intermediate Representation (IR)

The foundation of the system is a structured **Intermediate Representation (IR)** — a machine-readable, human-readable description of what a system does, expressed as nodes and edges.

```yaml
flow: daily_report_generation
description: Generates and distributes team performance reports on a schedule
service: vox-standup-bot
status: verified  # draft | verified (developer signed off)

nodes:
  - id: trigger
    type: start_event
    label: Scheduled trigger (cron)

  - id: check_existing
    type: decision
    label: Report already generated today?

  - id: skip
    type: task
    label: Increment skipped counter and exit

  - id: aggregate_metrics
    type: task
    label: Aggregate team metrics from DB
    calls: [aggregateTeamMetrics]
    logic_type: deterministic

  - id: send_notifications
    type: task
    label: Send proactive message to each team
    calls: [proactive.sendMessage]
    logic_type: deterministic

edges:
  - from: trigger
    to: check_existing

  - from: check_existing
    to: skip
    condition: "yes"
    runtime:
      observed: true
      frequency: 0.18
      confidence: static_plus_runtime

  - from: check_existing
    to: aggregate_metrics
    condition: "no"
    runtime:
      observed: true
      frequency: 0.82
      error_rate: 0.01
      avg_latency_ms: 120
      confidence: static_plus_runtime

  - from: aggregate_metrics
    to: send_notifications
```

The IR is the single source of truth. Everything else — diagrams, AI context, summaries — is generated from it.

### Confidence Model

Each node and edge carries a confidence level reflecting how it was derived:

- `static_only` — inferred from code, not yet observed in production
- `runtime_only` — observed in traces but not yet statically mapped
- `static_plus_runtime` — verified by both static analysis and runtime evidence

This makes uncertainty explicit and visible in the diagram. A business stakeholder can see which flows are fully verified vs which are inferred.

---

## Architecture

### Three Sources Feed the IR

**1. Static Analysis — PRIMARY**

Source of truth for structure. Defines what the system *can* do.

Two extractors, both deterministic, feeding the same IR schema:

*TypeScript Extractor* — Tool: `ts-morph` (TypeScript Compiler API)  
Extracts: service structure, function calls, conditional branches, async boundaries, decorator metadata (NestJS controllers, guards, interceptors)  
Applies to: all NestJS backends across GEIDI and JaB

*Dart Extractor* — Tool: `dart analyzer` (Dart's native analysis API — the direct equivalent of ts-morph for Dart)  
Extracts: Riverpod providers (map cleanly to IR nodes as discrete units of business state and logic), GoRouter navigation graphs (near-direct translation to IR edges), widget business logic, service calls  
Applies to: Just a Baby Flutter application  
Note: Riverpod and GoRouter are unusually well-structured for extraction. They impose conventions that make the Dart extractor simpler to build than typical frontend code would suggest.

**2. Runtime Traces — ENRICHMENT**

Source of truth for behaviour in production. Defines what the system *actually* does.

Tool: OTEL (already instrumented across the full stack)  
Extracts: actual execution paths, call frequency, error rates, latency, real branching behaviour under load

**Key principle:** OTEL is not used to construct logic. It is used to validate, enrich, and prioritise what static analysis has already extracted. Static analysis defines the structure. OTEL provides the evidence.

**3. LLM Labelling — ABSTRACTION**

Tool: Claude (via Claude Code plugin — see Developer Workflow below)  
Used for: naming nodes in business language, grouping low-level operations into logical phases, flagging where logic is probabilistic (LLM-driven) vs deterministic  
Not used for: parsing, control flow reconstruction, or any step that needs to be reliable

---

### Three Outputs from the IR

**1. XyFlow Interactive Viewer**  
A Next.js internal tool that loads IR files and renders them as interactive node-edge graphs. Built on XyFlow (already familiar to the team and already proven in production via the Flow Map). Nodes are clickable, flows are filterable by service, layer, logic type, and runtime confidence. Supports navigation across both NestJS backend flows and Flutter/Riverpod frontend state in a single graph. Accessible to developers and non-developers alike.

**2. Structured Context for AI**  
The IR YAML is fed directly into AI assistant sessions as system context. This closes the loop — AI tools can now reason about whole systems, not just individual files.

**3. Plain-language Flow Summaries**  
Auto-generated prose descriptions for stakeholder communication. One paragraph per flow, business language, no technical jargon.

---

## Technology Stack

| Concern | Tool | Rationale |
|---|---|---|
| TS/NestJS static analysis | `ts-morph` | TypeScript-native, NestJS-aware, deterministic |
| Dart/Flutter static analysis | `dart analyzer` | Dart-native equivalent of ts-morph; understands Riverpod and GoRouter patterns natively |
| Runtime enrichment | OTEL (existing) | Already instrumented on both backend and mobile; no new cost |
| LLM abstraction | Claude (via Claude Code plugin) | Labels and groups in business language; built into developer workflow |
| IR format | YAML | Human-readable, diffs cleanly in git, machine-parseable, language-agnostic |
| Interactive viewer | XyFlow (Next.js) | Already used by the team; renders IR nodes/edges directly; interactive, filterable, navigable |
| Storage | Git repo (`docs/flows/`) | Lives with the code, versioned, reviewable in PRs |

---

## Developer Workflow

Extraction is delivered as a **Claude Code plugin** — slash commands that run inside Claude Code during normal development. No separate pipeline, no new tools to learn.

```
/scan-logic src/       → scans the codebase, categorises functions by type
/extract-logic         → runs ts-morph extractor, produces draft IR YAML
/label-logic           → Claude labels nodes in business language
/view-flows            → opens XyFlow viewer with current IR
/check-coverage        → shows which flows have IR, which are missing
```

Packaged as an internal GEIDI Claude Code plugin. Any developer installs it once and gets the full workflow on any GEIDI project.

---

## Reusability Design

This is built once and applied across all projects. Reusability is achieved by:

**Stack conventions** — GEIDI standardises on NestJS + Next.js + OTEL for backend/web, and Flutter + Riverpod + GoRouter + OTEL for mobile. Both extractors are built against known conventions, not arbitrary code.

**IR schema is language-agnostic** — ts-morph and dart analyzer produce the same IR format. Everything downstream — the XyFlow viewer, AI context, summaries — is shared infrastructure regardless of source language.

**IR schema versioning** — The IR schema is documented and versioned. New projects adopt it from day one.

**New project checklist** — Future projects scaffold the IR structure at project creation. Logic is documented as it is built, not retroactively.

**Extractors as shared packages** — Both the TypeScript and Dart extractors are packaged as internal tools. Any project on either stack gets extraction for free.

---

## Abstraction Level

The IR and all outputs are maintained at business logic level, not code level.

A node represents a meaningful business action ("Aggregate team metrics") not a technical operation ("call aggregateTeamMetrics() on line 47").

The test: a business stakeholder should be able to point at any node in a diagram and say *"I understand what that does and why it matters."*

---

## Validation Model

The IR is a draft until reviewed by the developer who wrote the code. The extraction pipeline produces a first pass; the developer validates it in the same PR that ships the feature. This is the quality gate — not automated accuracy, but developer sign-off.

- `status: draft` — auto-extracted, not yet reviewed
- `status: verified` — developer signed off

CI drift detection runs on every PR and fails if new functions exist without IR entries, or if IR references deleted functions.

---

## Design Principles

1. **Static first** — structure comes from code, not runtime
2. **Runtime validated** — all logic can be enriched with OTEL evidence
3. **Human-readable** — every node must make sense to non-developers
4. **Honest representation** — confidence levels are explicit; uncertainty is shown, not hidden
5. **No APM drift** — this system produces understanding, not dashboards or alerts

---

## Phases

**Phase 0 — Already exists (Flow Map)**  
The Flow Map feature (Doc 24) is the proof of concept. XyFlow rendering complex interactive diagrams is already proven in production. The existing `diagram-definitions.ts`, element map, and custom tracer demonstrate that the approach works end-to-end. Phase 1 builds on this foundation.

**Phase 1 — Proof of concept**  
Pick one JaB backend flow (e.g. `dailyReport`). Manually produce the IR with Claude assistance. Render it in a basic XyFlow canvas. Validate with the team that the abstraction level is right. Discover any schema issues before building the extractor.

**Phase 2 — Semi-automated extraction (NestJS)**  
Build the ts-morph extractor for NestJS services. IR is auto-drafted, developer-reviewed. Claude Code plugin delivers `/scan-logic` and `/extract-logic` commands.

**Phase 2b — Semi-automated extraction (Flutter/Dart)**  
Build the dart analyzer extractor targeting Riverpod providers and GoRouter navigation. IR output feeds the same schema as Phase 2. Dart extraction is sequenced after NestJS to avoid parallel build cost.

**Phase 3 — OTEL enrichment**  
Map runtime traces to IR nodes and edges. Compute frequency, error rates, and latency per path. Populate the `runtime` block and confidence levels on each edge.

**Phase 4 — AI context integration**  
IR files are automatically included as context in Claude sessions for each codebase. AI assistance quality improves measurably. Validate by asking the same architecture question before and after IR context.

**Phase 5 — New project standard**  
All new GEIDI/JaB projects scaffold with IR structure from day one. Both extractors run in CI. The XyFlow viewer automatically reflects the latest IR on merge.

---

## Related Initiatives

### JaB: MongoDB Migration Phase -1 — Data Intelligence & Observability Layer

For Just a Baby specifically, the MongoDB Migration (v2.8, owner: Wayne Rondina) includes a Phase -1 called the **Data Intelligence & Observability Layer**. This is a related but distinct initiative that runs in parallel.

**They are complementary, not competing:**

| | MongoDB Migration Phase -1 | Logic Observability Layer |
|---|---|---|
| **Answers** | What data does the system have and how is it used? | What does the system do and why? |
| **Focus** | Schemas, collections, query patterns, field ownership | Business logic flows, decisions, actions |
| **Scope** | JaB only (MongoDB migration context) | All GEIDI/JaB projects |
| **Permanence** | Permanent capability post-migration | Permanent capability from day one |

**Where they share ground:**

Both initiatives use OTEL as an enrichment source — same Honeycomb data, no duplication. Both do static analysis of NestJS code. Phase -1's semantic coherence layer (Figma screens → NestJS endpoints → MongoDB collections) parses the same NestJS codebase that the ts-morph extractor targets. Wayne owns both, so coordination is natural.

**How they connect:**

Phase -1's semantic coherence graph — which maps UI screens to endpoints to data fields — is effectively a partial IR for the data layer. For JaB, this feeds into and enriches the Logic Observability IR: a flow node that says "fetch user profile" can be linked to the Phase -1 graph to show exactly which MongoDB collection and fields are involved.

**Practical implication:**

The NestJS static analysis work should not be built twice. When Wayne builds the ts-morph extractor for the Logic Observability Layer, the same parsing infrastructure should serve Phase -1's endpoint and DTO analysis. These should be coordinated as a single build, not two separate efforts.

For any GEIDI project that is not JaB, Phase -1 is not relevant — the Logic Observability Layer stands alone.

---

## Success Criteria

- A non-developer can describe what a given system flow does after reading its diagram, without developer explanation
- A developer onboarding to a new GEIDI project reaches working understanding in half the previous time
- AI assistant responses about system architecture are accurate and reference the full system, not just the file in context
- IR coverage reaches 80%+ of core business flows within 3 months of Phase 2 completion
- Auto-extracted nodes correctly identified on first draft at 70%+ before developer review
