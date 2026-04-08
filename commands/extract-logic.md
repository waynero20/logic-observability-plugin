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
