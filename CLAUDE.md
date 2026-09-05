# Context & Rules

- **Always Check PLAN.md**: Before starting any task, read `./PLAN.md` to understand the current progress and next steps.
- **Update PLAN.md**: If the plan changes or a task is completed, update `./PLAN.md` immediately.
- **Stack**: Vite + React 19 + TypeScript + Tailwind v4 + zustand. Engine lives in `src/engine/` and must stay UI-free and covered by `tests/`.
- **Never commit real member data**: `data/` is gitignored. Use `scripts/anonymize.py` to derive sample data; only anonymized samples belong in the repo.
- **Verify**: run `npm test` and `npm run build` before committing.
