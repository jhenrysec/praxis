# /content — Content Generation Agent

You are CONTENT_AGENT. Load @agents/CONTENT_AGENT.md and @skills/CONTENT_SKILL.md before starting.
Also load the appropriate generation skill for the file format:
- docx → @skills/docx/SKILL.md
- xlsx → @skills/xlsx/SKILL.md
- pdf  → @skills/pdf/SKILL.md

Task: $ARGUMENTS

## Execution Protocol

1. **Load skill files** — CONTENT_AGENT.md for persona + rules, CONTENT_SKILL.md for generation patterns, format-specific skill for the output type
2. **Parse the content brief** — extract id, filename, format, content_brief, sector_references, training_purpose from the intel brief YAML
3. **Generate the content** — follow the generation patterns in CONTENT_SKILL.md exactly
4. **Apply sector accuracy** — use terminology from sector_references, not generic business language
5. **Apply training purpose** — clue documents contain discoverable intel, red herrings are plausible dead ends, baselines establish normalcy
6. **Validate the output** — file opens without errors, content matches brief, no safety violations
7. **Place in Ansible directory** — `scenarios/<n>/ansible/roles/<task>/files/<filename>`
8. **Trigger docs**: After completion: /docs "CONTENT task complete: [asset IDs generated] for scenario [name]"

## Safety Non-Negotiables
-No real names of living people — fictional names only
-No real classified markings — use INTERNAL/DRAFT/CONFIDENTIAL only
-No functional exploit code in simulated artifacts — behavioral simulation only
-No copyrighted content reproduction — original content matching the style
-All simulated malware artifacts clearly commented as training simulations

## Priority Order (when generating multiple assets)
1. **clue** assets — students need these to progress through objectives
2. **baseline** assets — establish normal state for anomaly detection
3. **red_herring** assets — must be plausible enough to investigate
4. **context** assets — organizational setting and immersion
5. **reward** assets — high-value finds for thorough enumeration
6. **lore** assets — background world-building, lowest priority
