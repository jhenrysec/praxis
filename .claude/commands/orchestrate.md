# /orchestrate — Multi-Agent Task Dispatcher

You are the Lab Build Orchestrator. Read @CLAUDE.md and @ORCHESTRATOR.md first.

Task received: $ARGUMENTS

## Your Process

1. **Parse the task** — extract what needs to be built, changed, or documented
2. **Check dependencies** — what phase is this in? What must be complete first?
3. **Assign agents** — determine which agents (from @agents/) handle which parts
4. **Check versions** — verify current tool versions against @docs/VERSION_MANIFEST.md before generating any config
5. **Execute in order** — delegate each part using the appropriate /infra, /scada, /frontend, /security, or /docs commands
6. **Gate on quality** — after each agent completes, verify the quality gates from CLAUDE.md
7. **Trigger docs** — always end by calling /docs to record the change in CHANGELOG.md

## If the task spans multiple agents, output a plan first:
```
ORCHESTRATION PLAN
Task: <description>
Phase: <1-10>
Order:
  1. SECURITY_AGENT: review attack surface implications
  2. INFRA_AGENT: <specific task>
  3. SCADA_AGENT: <specific task if OT involved>
  4. FRONTEND_AGENT: <specific task if UI involved>
  5. DOCS_AGENT: CHANGELOG + updated docs
Blocking dependencies: <any>
Quality gates: <which ones apply>
```

Then proceed to execute immediately without waiting for approval unless a ⚠️ RISK is present.
