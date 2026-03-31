# /dedup-check — Scenario Deduplication Analysis

You are INTEL_AGENT performing a deduplication check before building a new scenario.

Task: $ARGUMENTS

## Purpose

Before building a new scenario from an intel brief, check existing scenarios for overlap
to prevent storage bloat and curriculum redundancy. A new scenario is only worth building
if it teaches techniques or skills not already covered by existing scenarios.

## Execution Protocol

1. **Parse the proposed scenario**
   Read the intel brief YAML specified in the arguments.
   Extract:
   - `scenario_card_metadata.mitre_enterprise_techniques[]`
   - `scenario_card_metadata.mitre_ics_techniques[]`
   - `infrastructure.assets[].role` and `infrastructure.assets[].substitution.template`
   - `attack_scheme.phases[].technique`
   - `scenario_card_metadata.difficulty`
   - `scenario_card_metadata.focus_areas[]`
   - `topology_context.sector`

2. **Scan existing scenarios**
   Read every `scenario.yaml` file in `terraform/scenarios/*/scenario.yaml`.
   Also read every `docs/scenarios/*/SCENARIO_CARD.md`.
   Also read every existing intel brief in `intel_briefs/*.yaml`.
   
   For each existing scenario, extract the same fields as above.

3. **Compute overlap scores**

   For each existing scenario, calculate:
   
   **Technique overlap** = (shared ATT&CK IDs) / (proposed ATT&CK IDs) × 100%
   - If > 80%: HIGH overlap — likely redundant
   - If 40-80%: MEDIUM overlap — partial redundancy, may still have value
   - If < 40%: LOW overlap — distinct scenario
   
   **Infrastructure overlap** = (shared VM templates) / (proposed VM templates) × 100%
   - This measures storage impact — shared templates mean lower marginal cost
   
   **Focus overlap** = do they target the same focus_areas AND difficulty?
   - Same focus + same difficulty = HIGH curriculum overlap
   - Same focus + different difficulty = LOW — different skill level
   - Different focus = NONE — complementary scenarios

4. **Generate dedup report**

   ```
   ═══════════════════════════════════════════════════════════════
   DEDUPLICATION ANALYSIS: <proposed_scenario_name>
   ═══════════════════════════════════════════════════════════════
   
   Proposed scenario: <name>
   Techniques: <count> (Enterprise: <n>, ICS: <n>)
   Templates required: <list>
   Estimated storage: <n> GB (new VMs) + <n> GB (shared templates)
   
   ─────────────────────────────────────────────────────────────
   OVERLAP WITH EXISTING SCENARIOS:
   ─────────────────────────────────────────────────────────────
   
   [1] vs <existing_scenario_name>
       Technique overlap: XX% (<shared_techniques>)
       Infrastructure overlap: XX% (<shared_templates>)
       Focus overlap: HIGH/MEDIUM/LOW/NONE
       Verdict: REDUNDANT / PARTIAL_OVERLAP / DISTINCT
       
       Unique techniques in proposed: <list of IDs not in existing>
       Unique techniques in existing: <list of IDs not in proposed>
   
   [2] vs <existing_scenario_name>
       ...
   
   ─────────────────────────────────────────────────────────────
   STORAGE IMPACT:
   ─────────────────────────────────────────────────────────────
   
   Templates already built: <list> (0 GB marginal cost)
   Templates needing build: <list> (<n> GB)
   Scenario-specific VMs: <n> linked clones (<n> GB estimated)
   Total marginal storage: ~<n> GB
   
   ─────────────────────────────────────────────────────────────
   CURRICULUM COVERAGE ANALYSIS:
   ─────────────────────────────────────────────────────────────
   
   New ATT&CK techniques this scenario adds to the lab:
     - T####: <name> (not covered by any existing scenario)
     - T####: <name>
   
   Techniques already fully covered elsewhere:
     - T####: <name> (covered by: <scenario_name>)
   
   ─────────────────────────────────────────────────────────────
   RECOMMENDATION:
   ─────────────────────────────────────────────────────────────
   
   BUILD / SKIP / MERGE
   
   BUILD: Scenario adds [n] unique techniques. Storage cost justified.
   SKIP:  XX% overlap with <scenario>. Consider enriching existing instead:
          /intel-enrich <existing_scenario> --source <brief_source>
   MERGE: Combine with <scenario> — overlapping infra, complementary techniques.
   
   ═══════════════════════════════════════════════════════════════
   ```

5. **If SKIP or MERGE is recommended**
   - Suggest the specific `/intel-enrich` command to add the unique techniques
     to the existing scenario instead of building a new one
   - Calculate the storage savings of enriching vs. building new

6. **If BUILD is recommended**
   - Confirm the build should proceed
   - Note which templates are already available (reduces build time)
   - Pass through to the orchestrator

## Decision Thresholds

| Technique Overlap | Focus Overlap | Infrastructure Overlap | Recommendation |
|---|---|---|---|
| > 80% | HIGH | Any | SKIP — enrich existing instead |
| > 80% | LOW/NONE | Any | BUILD — different training purpose |
| 40-80% | HIGH | > 60% | MERGE — combine into one scenario |
| 40-80% | LOW/NONE | Any | BUILD — complementary |
| < 40% | Any | Any | BUILD — distinct scenario |

## Integration Points

- Called automatically by `/intel-scenario` before build (step 5.5, between quality gate and YAML generation)
- Called manually: `/dedup-check intel_briefs/<filename>.yaml`
- ORCHESTRATOR checks this before routing to INFRA_AGENT
- Results logged in the intel brief metadata as `dedup_analysis` section
