---
description: Open the interactive flow viewer
---

Launch the standalone viewer (zero dependencies, works with steps-format YAML):

```
npx tsx scripts/standalone-viewer.ts docs/flows/
```

This runs from the **plugin directory**, not the target project. If running from a target project, use the full path to the plugin's script.

Tell the developer it's available at http://localhost:3200.

If the viewer fails to start, check:
- Are there YAML files in docs/flows/?
- If not, suggest running /scan-logic and /extract-logic first.
