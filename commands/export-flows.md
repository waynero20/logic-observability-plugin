---
description: Export flows as static HTML or SVG
---

Generate static exports from IR files.

If the developer specifies --format html: run `npx tsx scripts/generators/ir-to-html.ts`
If the developer specifies --format svg: run `npx tsx scripts/generators/ir-to-svg.ts`
If no format specified, generate both.

Report where the files were written: `docs/flows/generated/`
