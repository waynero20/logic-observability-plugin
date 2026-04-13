---
description: Extract approved logic into IR YAML files
---

Extract business logic for the functions approved in the previous /scan-logic step.

## What to do

1. For each approved function from the scan results:

   a. If TypeScript project: run `npx tsx scripts/extract-logic.ts <function-file:line> --json` and capture the output. The script **automatically cleans labels** into business language — no manual rewriting needed.
   b. If non-TypeScript: read the source file, identify control flow, and write IR YAML to `docs/flows/<flow-id>.yaml`.

2. Run validation: `npx tsx scripts/validate-ir.ts docs/flows/<flow-id>.yaml`

3. Show a **one-line summary per flow** (title, node count, status). Do NOT show full IR YAML unless the developer asks.

4. Report: "Extracted X flows to docs/flows/. Run /generate-all to produce diagrams, or /label-logic if you want to refine labels."

## Important: minimize token usage

- Do NOT rewrite labels yourself — the script handles this automatically.
- Do NOT show full YAML output — just the summary.
- Do NOT ask for per-flow approval — extract all at once, developer can review files directly.
- Batch multiple files in a single script call where possible: `npx tsx scripts/extract-logic.ts file1.ts:10 file2.ts:20 --json`
