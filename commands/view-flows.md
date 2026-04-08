---
description: Open the interactive flow viewer
---

Launch the standalone viewer: `npx tsx viewer/cli.ts docs/flows/`

Tell the developer it's available at http://localhost:3200.

If the viewer fails to start, check:
- Are there YAML files in docs/flows/?
- If not, suggest running /scan-logic and /extract-logic first.
