# Gap Closure — Integration Guide

## Files Created and Where They Go

### New Files (copy directly to repo)

| File | Destination in repo | Purpose |
|---|---|---|
| `scripts/iso-manifest.yaml` | `scripts/iso-manifest.yaml` | Master list of required ISOs with download URLs |
| `scripts/check-isos.sh` | `scripts/check-isos.sh` | Automated ISO check/download/upload script |
| `.claude/commands/dedup-check.md` | `.claude/commands/dedup-check.md` | Scenario deduplication analysis command |
| `.claude/commands/preflight.md` | `.claude/commands/preflight.md` | Pre-build infrastructure verification command |
| `.claude/commands/intel-scenario.md` | `.claude/commands/intel-scenario.md` | **REPLACES** existing file — adds --source file, dedup, preflight |
| `.claude/commands/phase.md` | `.claude/commands/phase.md` | **REPLACES** existing file — adds ISO checks, curriculum phase |
| `.claude/commands/curriculum.md` | `.claude/commands/curriculum.md` | Teaching material generation command |
| `.claude/commands/content-command.md` | `.claude/commands/content-command.md` | Content generation command (was missing) |
| `agents/CURRICULUM_AGENT.md` | `agents/CURRICULUM_AGENT.md` | Curriculum specialist agent persona |
| `scenarios/MANIFEST_TEMPLATE.yaml` | `scenarios/MANIFEST_TEMPLATE.yaml` | Template for scenario build manifests |
| `docs/VERSION_MANIFEST.md` | `docs/VERSION_MANIFEST.md` | **REPLACES** existing file — removes duplicate Project State |

### Files That Need Manual Edits

| File | What to change |
|---|---|
| `CLAUDE.md` | See `CLAUDE_PATCHES.md` — add 4 new agent routes, curriculum phase, preflight/dedup quality gates, key file paths |
| `ORCHESTRATOR.md` | See `ORCHESTRATOR_PATCHES.md` — add CONTENT_AGENT + CURRICULUM_AGENT to roster, add pre-build gates, update phase ordering |
| `COMMAND_EXAMPLES.md` | Append contents of `COMMAND_EXAMPLES_ADDITIONS.md` to the end |
| `.gitignore` | Append: `.iso-cache/` and `*.iso` lines |

### Make Scripts Executable

```bash
chmod +x scripts/check-isos.sh
```

### Install yq (required by check-isos.sh)

```bash
pip3 install yq --break-system-packages
```

---

## What Each Gap Closure Does

### Gap 1: ISO Acquisition Pipeline
**Problem**: No automation to check/download ISOs before Packer builds.
**Solution**: `iso-manifest.yaml` + `check-isos.sh` + Phase 4 integration.
**Flow**: `/phase 4` → runs `check-isos.sh` → downloads auto-fetchable ISOs → uploads to Proxmox → proceeds to Packer builds.
**Manual ISOs**: Windows Server 2022 and Windows 10 require manual download from Microsoft (form submission required). Script prints instructions.

### Gap 2: Scenario Deduplication
**Problem**: No check for redundant scenarios before building.
**Solution**: `/dedup-check` command runs automatically in `/intel-scenario` pipeline.
**Flow**: Intel brief generated → `/dedup-check` compares ATT&CK techniques against existing scenarios → recommends BUILD/SKIP/MERGE.
**Thresholds**: >80% technique overlap + same focus = SKIP. 40-80% + same focus = MERGE. <40% = BUILD.

### Gap 3: Infrastructure Preflight
**Problem**: No verification that templates/ISOs/bridges exist before building.
**Solution**: `/preflight` command runs automatically in `/intel-scenario` pipeline.
**Flow**: Brief generated → `/preflight` checks Proxmox for templates, queries ISO storage, verifies bridges and host resources → reports READY or BLOCKED.
**If blocked on ISOs**: Offers to auto-download, or prints manual download instructions.
**If blocked on templates**: Routes to INFRA_AGENT for Packer build first.

### Gap 4: Teaching Material Generation
**Problem**: Scenario cards exist but no structured lesson plans or curriculum.
**Solution**: CURRICULUM_AGENT + `/curriculum` command.
**Produces**: LESSON_PLAN.md (step-by-step instructor guide mapped to attack chain phases), SLIDES_CONTENT.md (slide-ready content), QUICK_REFERENCE.md (one-page student handout), INCIDENT_REPORT_TEMPLATE.md (blank student deliverable), DETECTION_EXERCISE.md (blue team track guide).
**Integration**: Called automatically at the end of `/intel-scenario` pipeline (Phase I-11).

### Gap 5: File-Based Whitepaper Ingestion
**Problem**: `/intel-scenario` only accepts URLs or paste, not local PDF files.
**Solution**: Updated `intel-scenario.md` adds `--source file <path>` option.
**Supports**: PDFs (via pdf-reading skill), .txt/.md (direct read), .doc/.docx (via file-reading skill).
**Common use case**: Instructor downloads paywalled Mandiant/CrowdStrike/Dragos report as PDF, uploads to Claude or places on management workstation, INTEL_AGENT ingests it directly.

### Gap 6: Scenario Manifests
**Problem**: No catalog of all artifacts constituting a deployable scenario.
**Solution**: `MANIFEST_TEMPLATE.yaml` + automatic generation after scenario build.
**Contains**: Every template, ISO, Terraform file, Ansible role, dressing document, artifact, and curriculum file. Enables deterministic redeployment from manifest.
**Stored at**: `scenarios/<scenario_name>/MANIFEST.yaml` (committed to git).

### Gap 7: CLAUDE.md + ORCHESTRATOR.md Updates
**Problem**: Missing `/content` and `/curriculum` agent routes. Missing CONTENT_AGENT and CURRICULUM_AGENT from ORCHESTRATOR roster.
**Solution**: Patch files document exact additions to both files.

### Gap 8: VERSION_MANIFEST.md Duplicate
**Problem**: Project State section duplicated at bottom of VERSION_MANIFEST.md.
**Solution**: Replacement file with duplicate removed.

---

## Updated End-to-End Pipeline

After applying all changes, the complete whitepaper-to-lab pipeline is:

```
Instructor provides whitepaper (URL, paste, or PDF file)
    ↓
/intel-scenario --source <source>
    ↓
Step 1: INTEL_AGENT ingests source (URL/paste/PDF)
Step 2: Scope detection — sector, ATT&CK frameworks, layer availability
Step 3: Five-layer extraction — attack chain, topology, infrastructure, IOCs, dressing
Step 4: Substitution logic — match source products to lab templates
Step 5: Quality gate — validate ATT&CK IDs, substitution fidelity
Step 6: Generate intel brief YAML
    ↓
Step 7: /dedup-check — compare against existing scenarios
  → BUILD: proceed
  → SKIP: suggest /intel-enrich instead
  → MERGE: ask instructor
    ↓
Step 8: /preflight — verify infrastructure
  → ISOs missing? Download/upload or print instructions
  → Templates missing? Build with Packer first
  → Bridges missing? Phase 3 not complete — stop
  → Resources insufficient? Warn instructor
    ↓
Step 9: ORCHESTRATOR routes to build agents
  → INFRA_AGENT: Terraform + Ansible for VMs and network
  → SCADA_AGENT: protocol configuration (if OT)
  → CONTENT_AGENT: dressing documents + simulated artifacts
  → SECURITY_AGENT: ATT&CK coverage review
    ↓
Step 10: DOCS_AGENT — scenario card, objectives, walkthrough
Step 11: CURRICULUM_AGENT — lesson plan, slides, exercises
Step 12: Write MANIFEST.yaml — catalog all build artifacts
    ↓
Scenario deployed. Instructor has:
  - Deployed lab environment matching the real incident
  - Step-by-step lesson plan mapped to the attack chain
  - Slide content for classroom briefing
  - Student handouts and assessment rubrics
  - One-command reset between student groups
```
