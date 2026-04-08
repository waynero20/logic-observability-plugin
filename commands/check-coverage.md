---
description: Check what's documented vs what isn't
---

Run `npx tsx scripts/scan-logic.ts <src-path> --check` to compare the codebase against existing IR files.

If no source path is provided, ask the developer which directory to scan.

Present the results:
- Functions with IR entries vs without
- Stale IR (references code that no longer exists)
- Draft vs verified status
- Coverage percentage

Suggest next actions:
- If stale IR found: "These IR files reference code that no longer exists. Consider removing or updating them."
- If low coverage: "Run /scan-logic to identify additional functions worth documenting."
- If many drafts: "Consider reviewing draft IR files and marking them as verified."
