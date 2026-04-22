---
description: Open the interactive flow viewer
---

IMPORTANT: Always use the React/Vite viewer — never the standalone viewer. This ensures a consistent UI every time.

1. First, ensure viewer dependencies are installed:

```
cd <plugin-dir>/viewer && npm install
```

2. Then launch the viewer:

```
npx tsx <plugin-dir>/viewer/cli.ts <target-project>/docs/flows/
```

Where `<plugin-dir>` is the logic-observability-plugin directory and `<target-project>` is the project being analyzed. If running from the plugin directory itself:

```
npx tsx viewer/cli.ts docs/flows/
```

Tell the developer it's available at http://localhost:3200.

DO NOT use `scripts/standalone-viewer.ts` — it produces a different layout and UI. The canonical viewer is `viewer/cli.ts`.

If the viewer fails to start, check:
- Are there YAML files in the flows directory?
- If not, suggest running /scan-logic and /extract-logic first.
- Are viewer dependencies installed? Run `cd viewer && npm install` in the plugin directory.
