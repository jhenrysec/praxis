# /intel-scenario — Build a Scenario from Threat Intelligence Source

You are INTEL_AGENT. Load @agents/INTEL_AGENT.md and @skills/INTEL_SKILL.md before starting.
Also load @skills/SCADA_SKILL.md if the source involves ICS/OT environments.

Task: $ARGUMENTS

---

## Command Syntax

```
/intel-scenario --source <url_or_paste_or_file> [options]

Options:
  --source      URL, "paste", or file path to a PDF/document   [required]
  --fidelity    strict | balanced | loose                       [default: balanced]
  --zones       comma-separated list of vmbr zones to use       [default: auto]
  --difficulty  Beginner | Intermediate | Advanced | Expert     [default: auto]
  --sector      override sector detection                       [default: auto-detect]
  --team        solo | pair | team                              [default: solo]
  --focus       red_team | blue_team | forensics | hunt | combined [default: combined]
  --skip-dedup  skip deduplication check                        [default: false]
  --skip-preflight skip infrastructure verification             [default: false]
```

## Examples

```
# Build from CISA advisory URL
/intel-scenario --source https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-049a \
                --fidelity balanced

# Build from a locally uploaded PDF file
/intel-scenario --source /mnt/user-data/uploads/mandiant_apt42_report.pdf \
                --fidelity strict \
                --focus forensics

# Build from a PDF on the management workstation
/intel-scenario --source ~/reports/dragos_pipedream_2024.pdf \
                --sector energy \
                --difficulty Advanced

# Build from MITRE ATT&CK group page with strict fidelity
/intel-scenario --source https://attack.mitre.org/groups/G0114/ \
                --fidelity strict \
                --difficulty Advanced

# Build blue team / forensics scenario from IR report
/intel-scenario --source https://www.mandiant.com/resources/reports/... \
                --fidelity balanced \
                --focus forensics \
                --team pair

# Operator pastes whitepaper content directly
/intel-scenario --source paste \
                --fidelity loose \
                --sector energy
```

---

## Execution Protocol

1. **Load skill files**
   Load INTEL_AGENT.md, INTEL_SKILL.md, and SCADA_SKILL.md (if OT scope detected).

2. **Ingest source**
   - If `--source` is a URL: use `web_fetch` to retrieve the document.
     For PDFs at URLs, follow pdf-reading/SKILL.md extraction approach.
   - If `--source paste`: acknowledge and wait for operator to paste content.
   - If `--source` is a file path (ends in .pdf, .doc, .docx, .txt, or is a path):
     a. Verify the file exists at the specified path
     b. For PDFs: load @skills/pdf-reading/SKILL.md, extract content using the
        PDF reading pipeline (text extraction → page rasterization for diagrams →
        table extraction for IOC tables)
     c. For .txt/.md: read file content directly
     d. For .doc/.docx: load @skills/file-reading/SKILL.md, extract text content
   - If source requires authentication: prompt operator to paste content or
     provide a local file path.

3. **Detect scope** (before full extraction)
   Quickly scan the source to determine:
   - Sector (energy, manufacturing, financial, etc.)
   - IT-only vs. IT/OT combined scope
   - Approximate ATT&CK framework (Enterprise, ICS, or both)
   - Estimated layer availability (which of the 5 layers have data)
   
   Report scope detection to operator before proceeding:
   ```
   Source: [title]
   Detected scope: [sector] — [IT|OT|combined]
   ATT&CK frameworks: [Enterprise|ICS|both]
   Layer availability estimate:
     Layer 1 (Attack Chain): [HIGH|MEDIUM|LOW|NONE]
     Layer 2 (Topology): [HIGH|MEDIUM|LOW|NONE]
     Layer 3 (Infrastructure): [HIGH|MEDIUM|LOW|NONE]
     Layer 4 (IOCs/Artifacts): [HIGH|MEDIUM|LOW|NONE]
     Layer 5 (Dressing): [HIGH|MEDIUM|LOW|NONE]
   Proceeding with extraction...
   ```

4. **Run all five extraction passes**
   Execute each layer extraction per INTEL_AGENT.md specification.
   Do not skip layers even if source availability is LOW — extract what exists
   and mark the layer as partial or not_available_in_source.

5. **Run substitution logic**
   For each infrastructure asset, apply the substitution decision logic:
   1. Exact template match → no substitution
   2. Same protocol/behavior on different product → substitute with note
   3. CVE not reproducible → find closest analog
   4. No analog → flag as gap, do not fabricate
   5. Licensed/proprietary → document gap explicitly

6. **Quality gate**
   Before writing the brief, verify all quality gates from INTEL_AGENT.md.
   If any gate fails, fix before proceeding.

7. **Generate intel brief YAML**
   Write the complete brief to:
   `intel_briefs/<adversary_or_topic>_<YYYY-MM-DD>.yaml`
   
   Use the complete schema from INTEL_SKILL.md. Every required field must
   be populated. Optional fields populated where source supports them.

8. **Deduplication check** (unless --skip-dedup)
   Run `/dedup-check intel_briefs/<filename>.yaml`
   
   - If recommendation is SKIP: report to instructor, suggest `/intel-enrich` instead.
     Do NOT proceed to build unless instructor explicitly overrides.
   - If recommendation is MERGE: report the merge opportunity and ask for confirmation.
   - If recommendation is BUILD: proceed to step 9.

9. **Infrastructure preflight** (unless --skip-preflight)
   Run `/preflight intel_briefs/<filename>.yaml`
   
   - If READY: proceed to build.
   - If BLOCKED on ISOs:
     - Auto-downloadable ISOs: offer to run `./scripts/check-isos.sh --download --upload`
     - Manual ISOs: print download instructions and STOP until resolved.
   - If BLOCKED on templates:
     - Packer file exists: offer to build the template first, then continue.
     - Packer file missing: STOP — INFRA_AGENT must create the template.

10. **Generate orchestrator handoff**
    Produce the structured handoff block per INTEL_AGENT.md handoff protocol.
    This is what triggers the downstream build pipeline.
    
    Include in the handoff:
    - Dedup analysis results (what's new vs. existing)
    - Preflight status (what templates needed building)
    - ISO status (all available or any downloaded during preflight)

11. **Trigger downstream agents**
    After handoff block is printed, trigger:
    ```
    /orchestrate build scenario from intel_briefs/<filename>.yaml
    ```
    The orchestrator handles routing Layer 2/3 to INFRA_AGENT,
    Layer 3 OT details to SCADA_AGENT, gaps to DOCS_AGENT.

12. **Generate teaching materials**
    After scenario infrastructure is built:
    ```
    /curriculum generate teaching materials for <scenario_name> \
      from intel_briefs/<filename>.yaml
    ```

13. **Generate scenario manifest**
    Write `scenarios/<scenario_name>/MANIFEST.yaml` with all build artifacts,
    templates used, ISOs required, and Ansible roles — enabling future
    redeployment without re-running the full pipeline.

14. **Trigger docs**
    After orchestrator confirms build:
    ```
    /docs INTEL_AGENT task complete: generated intel brief <filename>
    from source: <title>. Update CHANGELOG.md and PROJECT_STATE.md.
    ```

---

## Output Format

### Scope Detection Block (printed before extraction)
```
═══════════════════════════════════════════════════════════════
INTEL_AGENT — Source Analysis
═══════════════════════════════════════════════════════════════
Source: [document title]
Type: [mitre_attack|cisa_advisory|ir_report|whitepaper|file]
Format: [url|paste|pdf|document]
Fidelity: [strict|balanced|loose]

Detected sector: [sector/subsector]
ATT&CK scope: [Enterprise|ICS|combined]

Layer availability:
  ■ Layer 1 — Attack Chain:    [HIGH/MEDIUM/LOW/NONE]
  ■ Layer 2 — Topology:        [HIGH/MEDIUM/LOW/NONE]
  ■ Layer 3 — Infrastructure:  [HIGH/MEDIUM/LOW/NONE]
  ■ Layer 4 — IOC Artifacts:   [HIGH/MEDIUM/LOW/NONE]
  ■ Layer 5 — Dressing:        [HIGH/MEDIUM/LOW/NONE]

Proceeding with full extraction...
═══════════════════════════════════════════════════════════════
```

### Completion Block (printed after brief is written)
```
═══════════════════════════════════════════════════════════════
INTEL_AGENT — Brief Complete
═══════════════════════════════════════════════════════════════
Brief file: intel_briefs/<filename>.yaml

ATTACK CHAIN ([n] phases):
  1. [tactic] — [T####] [technique name]
  2. [tactic] — [T####] [technique name]
  ...

DEDUP CHECK:
  [n] existing scenarios analyzed
  Technique overlap: [highest overlap %] with [scenario_name]
  Recommendation: BUILD / SKIP / MERGE

PREFLIGHT CHECK:
  Templates: [n] available, [n] need building
  ISOs: [n] available, [n] downloaded, [n] manual
  Resources: [sufficient/insufficient]
  Verdict: READY / BLOCKED

TOPOLOGY REQUIREMENTS → INFRA_AGENT:
  • [bullet list of specific configs]

INFRASTRUCTURE ([n] assets, [n] substitutions, [n] gaps):
  • [asset role]: [source product] → [lab substitute]
  • GAP: [source product] — [reason]

ARTIFACT STAGING ([n] artifacts) → Ansible:
  • [IOC-###] [type] on [host_role]: [description]

DRESSING ASSETS ([n] files) → Content generation:
  • [DRESS-###] [host_role]/[filename]: [one-line brief]

TEACHING MATERIALS → CURRICULUM_AGENT:
  • Lesson plan, slides, incident report template, detection exercise

SUBSTITUTION GAPS → DOCS_AGENT:
  • [source product]: [fidelity loss description]

Triggering build pipeline...
═══════════════════════════════════════════════════════════════
```
