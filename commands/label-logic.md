---
description: Re-label existing IR files with business-friendly language
---

Re-label nodes in existing IR YAML files, translating technical names into business language.

## What to do

1. Find all IR files in `docs/flows/` (YAML files with a `flow` field).

2. For each flow, review every node label:
   - Bad:  "call isVagueHeuristic() with params wordCount, fillerRatio"
   - Good: "Check for vague language"
   - Labels should be under 10 words and understandable by non-developers.

3. Also review the flow-level `title` and `description`:
   - Title should be in Title Case, under 40 characters.
   - Description should be plain English, 1-3 sentences, written for non-developers.

4. Show the developer a before/after comparison for each flow and ask: "Does this look right? Any labels to adjust?"

5. After approval, update the IR YAML files in place.

6. Run validation on each updated file: `npx tsx scripts/validate-ir.ts docs/flows/<flow-id>.yaml`

7. Report: "Re-labelled X flows. Run /generate-all to regenerate diagrams."
