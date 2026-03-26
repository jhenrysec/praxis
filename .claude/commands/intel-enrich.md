# /intel-enrich — Enrich an Existing Scenario with Threat Intelligence

You are INTEL_AGENT. Load @agents/INTEL_AGENT.md and @skills/INTEL_SKILL.md before starting.

Task: $ARGUMENTS

---

## Command Syntax

```
/intel-enrich <scenario_name> --source <url_or_paste> [options]

Arguments:
  <scenario_name>   Existing scenario directory name (e.g., scada_modbus_recon)

Options:
  --source          URL or "paste"                               [required]
  --fidelity        strict | balanced | loose                    [default: balanced]
  --layers          comma-separated layers to run: 1,2,3,4,5    [default: all]
  --auto-apply      skip review gate for doc-only changes        [default: false]
```

## Examples

```
# Enrich existing scenario with CISA advisory
/intel-enrich scada_modbus_recon \
              --source https://www.cisa.gov/uscert/ics/advisories/icsa-22-258-05

# Enrich ATT&CK coverage only (layers 1 and 4)
/intel-enrich cred_access_kerberoasting \
              --source https://attack.mitre.org/techniques/T1558/003/ \
              --layers 1,4

# Enrich with IR report, strict fidelity, auto-apply doc changes
/intel-enrich ics_ot_pivot \
              --source https://dragos.com/resource/... \
              --fidelity strict \
              --auto-apply
```

---

## Execution Protocol

1. **Load skill files**
   Load INTEL_AGENT.md, INTEL_SKILL.md.

2. **Read existing scenario**
   Read these files for the target scenario:
   - `docs/scenarios/<scenario_name>/SCENARIO_CARD.md`
   - `docs/scenarios/<scenario_name>/OBJECTIVES.md`
   - `docs/scenarios/<scenario_name>/WALKTHROUGH.md` (if exists)
   - `terraform/scenarios/<scenario_name>/main.tf` (if exists)
   
   Build an internal model of what the scenario currently covers:
   - Current ATT&CK techniques
   - Current VM inventory
   - Current objectives
   - Current network topology

3. **Ingest source** (same as /intel-scenario step 2)

4. **Run extraction passes** (only specified layers, default all)

5. **Diff analysis**
   Compare source extraction against current scenario model.
   Categorize every finding as one of:
   
   **DOCUMENTATION_UPDATE** — No structural change needed, docs only:
   - Missing ATT&CK technique ID that's already implemented
   - Improved objective wording that matches source more closely
   - Missing IOC documentation for artifact already in scenario
   - Citation addition
   - Dressing document that can be added without VM changes
   
   **STRUCTURAL_CHANGE** — Requires INFRA_AGENT / Ansible work:
   - New VM needed
   - New network path / firewall rule
   - New Ansible role for artifact staging
   - Topology change (new dual-homed adapter, etc.)
   - New dressing documents requiring content generation
   
   **GAP_ACKNOWLEDGED** — Source reveals something not replicable:
   - Licensed product with no substitute
   - Technique requires hardware not in lab
   - CVE too risky to reproduce
   - Note in scenario card, no action

6. **Generate enrichment proposal**
   Write proposal to:
   `intel_briefs/enrichment_<scenario_name>_<YYYY-MM-DD>.yaml`
   
   Proposal structure:
   ```yaml
   enrichment_proposal:
     scenario: ""
     source: ""
     generated: ""
     
     documentation_updates:       # Safe to apply immediately
       - target_file: ""          # docs/scenarios/.../SCENARIO_CARD.md
         change_type: ""          # add_technique|update_objective|add_citation|add_ioc
         current: ""              # current content (if replacing)
         proposed: ""             # proposed content
         rationale: ""            # why source supports this change
     
     structural_changes:          # Require instructor approval
       - change_type: ""          # new_vm|new_firewall_rule|new_ansible_role|topology_change
         description: ""
         rationale: ""
         estimated_impact: ""     # low|medium|high — impact on existing scenario
         implements_as: {}        # specific config for INFRA_AGENT
     
     gaps_acknowledged:
       - description: ""
         reason: ""
         scenario_card_note: ""   # text to add to scenario card explaining the gap
   ```

7. **Present proposal to instructor**
   Print a clear summary:
   ```
   DOCUMENTATION UPDATES ([n] changes — safe to apply now):
     [list each change with before/after]
   
   STRUCTURAL CHANGES ([n] changes — REQUIRE YOUR APPROVAL):
     [list each change with description and impact]
   
   GAPS ACKNOWLEDGED ([n] items — no action needed):
     [list each gap]
   
   Apply documentation updates now? [y/N]
   Review structural changes? [y/N]
   ```

8. **Apply documentation updates**
   If `--auto-apply` flag set OR instructor confirms:
   Pass documentation_updates to DOCS_AGENT for immediate application.
   
   ```
   /docs enrich scenario <scenario_name> per proposal:
   intel_briefs/enrichment_<scenario_name>_<date>.yaml
   Apply documentation_updates section only.
   ```

9. **Queue structural changes**
   If instructor approves structural changes:
   Pass to ORCHESTRATOR for INFRA_AGENT execution.
   
   ⚠️ RISK: Structural changes to a deployed scenario will require
   terraform destroy + rebuild or targeted Ansible re-runs.
   Confirm with instructor before triggering if scenario is live.

10. **Trigger docs**
    ```
    /docs INTEL_AGENT enrichment complete: <scenario_name>
    enriched from source: <title>.
    [n] documentation updates applied, [n] structural changes queued.
    Update CHANGELOG.md.
    ```

---

## Output Format

### Proposal Summary Block
```
═══════════════════════════════════════════════════════════════
INTEL_AGENT — Enrichment Proposal: <scenario_name>
═══════════════════════════════════════════════════════════════
Source: [title]
Existing scenario coverage: [n] techniques, [n] VMs, [n] objectives

DIFF RESULTS:
  Documentation updates (safe, no rebuild): [n]
  Structural changes (require approval):    [n]
  Gaps acknowledged (no action):            [n]

─────────────────────────────────────────────────────────────
DOCUMENTATION UPDATES:
─────────────────────────────────────────────────────────────
[1] ADD ATT&CK technique T####.### to scenario card
    Source says: [quote or paraphrase]
    Current card has: [what's there now or "not covered"]

[2] UPDATE objective #3 wording
    Current: "[current objective text]"
    Proposed: "[source-grounded objective text]"
    Rationale: [why this is more accurate]

─────────────────────────────────────────────────────────────
STRUCTURAL CHANGES (⚠️ REQUIRE APPROVAL):
─────────────────────────────────────────────────────────────
[1] ADD dual-homed historian VM
    Source reveals: [description]
    Implements as: [specific config]
    Impact: MEDIUM — requires new VM, new pfSense rule, scenario rebuild

─────────────────────────────────────────────────────────────
GAPS ACKNOWLEDGED:
─────────────────────────────────────────────────────────────
[1] [product]: [reason not replicable]
    Card note: "[text that will be added to scenario card]"

═══════════════════════════════════════════════════════════════
Apply documentation updates now? Type YES to proceed.
Review structural changes? Type YES to see full detail.
═══════════════════════════════════════════════════════════════
```
