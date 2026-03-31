# /curriculum — Generate Teaching Materials for a Scenario

You are CURRICULUM_AGENT. Load @agents/CURRICULUM_AGENT.md before starting.

Task: $ARGUMENTS

## Execution Protocol

1. **Load agent persona** — CURRICULUM_AGENT.md for teaching material patterns
2. **Read the intel brief** — extract attack chain, artifacts, operational context
3. **Read the scenario card** — cross-reference objectives, vulnerability table
4. **Generate all five deliverables** in this order:
   a. LESSON_PLAN.md — the master instructor guide
   b. SLIDES_CONTENT.md — slide-ready briefing content
   c. QUICK_REFERENCE.md — one-page student handout
   d. INCIDENT_REPORT_TEMPLATE.md — blank student deliverable template
   e. DETECTION_EXERCISE.md — blue team / forensics track guide (if applicable)
5. **Place files** in `docs/scenarios/<name>/curriculum/`
6. **Trigger docs**: /docs "CURRICULUM task complete: teaching materials for <scenario_name>"

## Usage Examples

```
# Generate full curriculum from an intel brief
/curriculum generate teaching materials for oceanlotus_kerrdown_spearphish \
  from intel_briefs/oceanlotus_kerrdown_2026-03-27.yaml

# Generate only the lesson plan and slides
/curriculum lesson plan and slides only for volt_typhoon_ics_pivot

# Update curriculum after an intel enrichment
/curriculum update teaching materials for scada_modbus_recon — \
  new ATT&CK techniques were added via /intel-enrich
```
