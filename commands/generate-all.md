---
description: Generate all outputs from IR YAML files
---

Run `npx tsx scripts/generate-all.ts` to produce all outputs from the IR files in docs/flows/.

Report what was generated: XYFlow definitions, BPMN XML, HTML exports, SVG exports, summaries, and element map (if applicable).

Show the developer where the files were written and suggest next steps:
- "Open the HTML files in a browser to preview diagrams"
- "Run /view-flows to launch the interactive viewer"
- "Run /export-flows --format svg for standalone SVG exports"
