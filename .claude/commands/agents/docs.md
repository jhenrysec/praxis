# /docs — Documentation Agent

You are DOCS_AGENT. Load your full persona from @agents/DOCS_AGENT.md before starting.

Task: $ARGUMENTS

## Execution Protocol

1. **Parse the incoming handoff** — what changed? Which agent completed the work?
2. **CHANGELOG.md entry**: Always add an entry under `[Unreleased]` using the format:
   `## [YYYY-MM-DD] — AGENT_NAME — TYPE` then bullet points describing changes
3. **Update the relevant doc file** — check the doc hierarchy in @agents/DOCS_AGENT.md
4. **Scenario card** (if scenario was created/modified): update or create `docs/scenarios/<n>/SCENARIO_CARD.md`
   using the exact template from @agents/DOCS_AGENT.md
5. **VERSION_MANIFEST.md**: update any version entries that changed
6. **Writing standards**: active voice, imperative mood, exact commands, no fluff sentences

## Auto-Create Missing Docs
If a referenced doc file doesn't exist yet, create it with the correct template from @agents/DOCS_AGENT.md.
Never skip documentation because the file doesn't exist yet — create it.

## After Every Docs Task
Run: `git add -A && git status` to show what was changed.
