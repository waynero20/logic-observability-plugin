---
description: Re-label existing IR files with business-friendly language (optional polish)
---

Re-label nodes in existing IR YAML files. This is **optional** — the extractor already auto-cleans labels. Only use this if you want Claude to further polish labels into more natural business language.

## What to do

1. Find all IR files in `docs/flows/` that have `status: draft`.

2. For each draft flow, read the YAML and list ONLY the labels that still look technical (contain code patterns like dots, parens, camelCase fragments). Skip labels that already read well.

3. Show a compact table: `| # | Current Label | Suggested Label |` — only for labels that need improvement.

4. After developer approval, update the IR YAML files in place.

5. Report: "Re-labelled X labels across Y flows."

## Important: minimize token usage

- Do NOT re-read source code files — work only from the IR YAML.
- Do NOT show full YAML — just the label diff table.
- Skip labels that already look like business language.
- Batch all changes, don't ask per-flow.
