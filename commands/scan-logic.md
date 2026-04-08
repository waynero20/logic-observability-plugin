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
