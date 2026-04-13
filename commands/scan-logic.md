---
description: Scan codebase for extractable business logic
---

Scan the specified directory and present a categorized list of functions that contain business logic.

## What to do

1. Check if target path has a `tsconfig.json` (TypeScript project).
   - If YES: run `npx tsx scripts/scan-logic.ts <target-path> --json` and parse the JSON output.
   - If NO: read source files in the target path yourself. Identify functions, decision points, and API calls. Categorize them using the rules below.

2. Present results as a compact categorized table: #, Function, File:Line, Type, Branches, Extract?

3. Show summary: "X found, Y recommended, Z skipped, W already documented"

4. Ask: "Review the list. Tell me which to add/remove, then run /extract-logic."

5. Remember the approved list for /extract-logic.

## Important: minimize token usage

- For TypeScript projects, rely entirely on the script output — do NOT read source files yourself.
- Show the table and summary only — no per-function analysis.
- Do NOT explain what each function does unless asked.
