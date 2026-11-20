# Backlog

Work that didn't fit its day, plus project items. Weekend catch-up comes from here. Remove items when they're done.

## Project
- [ ] Record the exam date in `CLAUDE.md` → Progress.
- [ ] If days keep running well over 3 hours, decide: stretch the schedule, or move the app blocks to weekends.
- [ ] Before the first deploy: the prompt loader reads `src/core/prompts/**/*.md` with `fs` at runtime, so add them to the server trace with `outputFileTracingIncludes` in `next.config.ts` (Next docs: `output.md`). Check with `npm run build`.

## Spilled over from a day
- [ ] **Day 4 · Practice: spaced-repetition review of saved cards** (plain code, no Claude: a workflow decision). Blocked: `/practice` generates decks but saves no cards, so a card store comes first.

## After the course (ROADMAP levels 2–3)
- [ ] The Labs page in the app (run lab variants from the UI)
- [ ] Polish the Drills page and the replay demo
- [ ] Exercise mode for others, the Claude Code plugin, the write-ups (only after the exam)
