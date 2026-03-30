# INTEL_AGENT — Capability Assessment

**Date**: 2026-03-27
**Author**: Ant (David Carson) + Claude (assessment partner)
**Scope**: Evaluation of INTEL_AGENT extraction fidelity, builder agent handoff quality,
           and identified gaps after testing against three source types

---

## Sources Tested

| Source | Type | Sector | Layers Available | Brief Produced |
|--------|------|--------|------------------|----------------|
| CISA AA23-144A (Volt Typhoon) | CISA Advisory | Energy/Electric Utility | All 5 — HIGH | volt_typhoon_ics_pivot_2025-06-01.yaml |
| Unit 42 — OceanLotus KerrDown | IR Report | Government | All 5 — HIGH | oceanlotus_kerrdown_2026-03-27.yaml |
| Mandiant — APT42 Uncharmed | IR Report | Government/NGO | 1,3,4 HIGH; 2,5 MEDIUM | apt42_charming_kitten_2026-03-27.yaml |

---

## Strengths — What Works

### 1. Layer 1 (Attack Chain) → ORCHESTRATOR: Strong

The INTEL_AGENT consistently produces ordered, ATT&CK-mapped attack phases with
technique IDs, adversary actions, detection opportunities, and lab objectives.
The `constraints` section (prohibited actions, required conditions) gives the
orchestrator clear guardrails for scenario design. The builder agents receive
unambiguous sequencing — they know what must come before what.

**Evidence**: All three briefs produced 5-7 phase attack chains with valid
ATT&CK technique IDs. Constraints correctly captured adversary-specific
behavioral patterns (Volt Typhoon LOLBins-only, OceanLotus no commodity RATs,
APT42 no exploit kits).

**Builder agent impact**: ORCHESTRATOR can route phases to specialist agents
without interpretation. SECURITY_AGENT gets the ATT&CK mapping table ready-made.

### 2. Layer 3 (Infrastructure) → INFRA_AGENT: Strong

VM specifications are complete: template names, CPU/memory/disk, network adapters
with bridge assignments and IPs, and `additional_config` lists that translate
directly to Ansible task requirements. The substitution logic works correctly —
it documents what was changed, why, and whether the ATT&CK technique is preserved.

**Evidence**: Volt Typhoon brief: FortiGate → nginx substitution correctly
preserved T1190 while documenting the fidelity loss. OceanLotus brief: exact
template matches for all four VMs. APT42 brief: M365 gap correctly flagged
as a licensing constraint with three mitigation options.

**Builder agent impact**: INFRA_AGENT can write `main.tf` directly from the
`vm_config` blocks. Ansible role names are specified — even if the roles
don't exist yet, INFRA_AGENT knows what to create.

### 3. Layer 4 (IOC Artifacts) → Ansible Staging: Strong

Artifact catalogs are well-structured with host role, file paths, staging
methods, detection value descriptions, and difficulty ratings. The distinction
between `intentional` (adversary knowingly left it) and inadvertent artifacts
is a valuable training nuance that the brief captures consistently.

**Evidence**: OceanLotus brief: 7 artifacts spanning filesystem, network, memory,
and Windows events. APT42 brief: 7 artifacts including registry forensics and
simulated malware. All have Ansible role references and staging methods.

**Builder agent impact**: INFRA_AGENT writes Ansible tasks from the staging
specifications. The `difficulty` and `hint_available` fields inform the
instructor walkthrough and hint system in the portal.

### 4. Raw IOC Lists: Comprehensive

Domain lists, file hashes, YARA rules, User-Agent strings, and file names
are extracted directly from sources and included in the brief. These feed
directly into detection rules, analyst workstation tool configurations,
and scenario card appendices.

**Evidence**: APT42 brief: 16 domains, 11 file hashes, 5 YARA rule names,
9 filenames, and a custom User-Agent string extracted from the Mandiant report.

### 5. Fidelity Levels: Working as Designed

The strict/balanced/loose fidelity system correctly modulates how tightly
the scenario must match the source. The `constraints.prohibited` list in
strict mode prevents students from using techniques the adversary avoided —
which is a genuinely valuable training constraint that teaches adversary
emulation discipline.

---

## Shortfalls — What Needs Work

### 1. Layer 2 (Topology) Is Source-Dependent — Cannot Be Fixed by the Agent

**Problem**: When the source doesn't describe victim network topology (common
in credential-harvesting-focused reports like APT42), Layer 2 is thin. The
INTEL_AGENT correctly marks `available_in_source: false` and infers a
reasonable topology, but INFRA_AGENT is then building from inference rather
than source-grounded specification.

**Impact**: For enterprise AD and ICS scenarios, Layer 2 is usually well-documented
in sources (CISA advisories describe dual-homed historians, IT/OT boundaries, etc.).
For cloud-identity and social engineering campaigns, the "topology" is the identity
infrastructure (Azure AD, M365 tenant config, MFA settings) — which doesn't map
onto the lab's four-bridge model.

**Not fixable by the agent**: This is a source content limitation. The agent
already handles it correctly by marking the layer as partial and providing
best-effort inference. The real mitigation is source selection — choose sources
that describe the victim environment, not just the attacker's tools.

**Recommendation**: Add a source selection guide to the operator documentation.
Sources from CISA, Dragos, and detailed IR case studies typically provide strong
Layer 2 content. Technique-focused reports (ATT&CK pages, tool analyses) and
adversary-profile-focused reports (like the APT42 report) typically do not.

### 2. Layer 5 (Dressing) Specifies Content But Cannot Generate It

**Problem**: The INTEL_AGENT produces detailed `content_brief` fields for every
dressing asset — what the document should contain, what terminology to use, how
many pages/rows, what training purpose it serves. But the agent cannot produce
the actual files. The `generates_via` field points to a skill (docx_skill,
xlsx_skill) but no agent in the original stack was responsible for invoking
that skill with the content brief as input.

**Impact**: Without the CONTENT_AGENT (now built), dressing generation fell
implicitly on INFRA_AGENT — which is the wrong agent for creative content work.
The gap was not visible until the pipeline was tested end-to-end because the
briefs looked complete (they specify what to generate) but the execution path
for actually generating the content was unowned.

**Status**: RESOLVED — CONTENT_AGENT now owns this step. ORCHESTRATOR routes
Layer 5 dressing assets to CONTENT_AGENT after the brief is generated.

### 3. Cloud-Native Environments Are an Architectural Gap

**Problem**: APT42's most distinctive TTPs (MFA push fatigue, app password
exploitation, Azure AD sign-in log analysis, OneDrive exfiltration telemetry)
all require a real cloud environment. The lab is Proxmox/on-prem. This is not
an INTEL_AGENT extraction problem — the agent correctly identifies and documents
the gap. It's a lab infrastructure limitation.

**Impact**: For cloud-first adversaries (APT42, APT29 cloud ops, various
cloud-focused campaigns), the brief will always include a substitution gap
section that says "M365/Azure AD/GWS not replicable on-prem." The builder
agents can construct the on-premises components but cannot automate cloud
tenant provisioning.

**Recommendation**: Three-tier approach for cloud scenarios:
1. **On-prem simulation** (default): hMailServer for email, pre-exported audit
   logs for forensics track. INFRA_AGENT can automate this fully.
2. **Hybrid** (recommended for advanced students): Free M365 E5 dev tenant
   provisioned manually by instructor. Brief should include a `cloud_setup`
   section with manual configuration steps. Portal should support linking
   external cloud resources to lab slots.
3. **Full cloud** (future consideration): Terraform Azure provider for
   automated M365 tenant provisioning. Requires Azure subscription. Would
   need a new skill file (AZURE_SKILL.md) and INFRA_AGENT updates.

### 4. Simulated Malware Artifacts Require Careful Crafting

**Problem**: The brief specifies behavioral analogs for real malware (NICECURL
VBS, TAMECAT PS1, Cobalt Strike Beacon) but the actual simulation code must be
written to produce correct forensic observables without being functional malware.
This is a narrow, safety-critical content generation task.

**Impact**: If simulations are too simple, students learn nothing from analyzing
them. If simulations accidentally include functional exploit code, the lab
environment has a safety problem. The quality bar is exact: the simulation must
produce the right file paths, registry keys, network callbacks, and process
artifacts while doing nothing actually malicious.

**Status**: PARTIALLY RESOLVED — CONTENT_AGENT now includes simulated artifact
generation patterns with explicit safety rules. However, each new malware family
requires a custom simulation script. This is per-scenario work that cannot be
fully templated.

**Recommendation**: Build a library of simulated artifact patterns in
`scenarios/common/simulations/` that CONTENT_AGENT can adapt per scenario.
Start with: simulated VBS dropper, simulated PS1 backdoor, simulated LNK
downloader, simulated C2 beacon callback. Each pattern is a safe behavioral
template with placeholders for scenario-specific values (C2 IP, file paths,
registry keys).

### 5. Source Ingestion for Paywalled or Authenticated Content

**Problem**: Some of the best IR reports (Mandiant, CrowdStrike, Dragos) are
behind paywalls or require authentication. `web_fetch` fails on these sources.
The current workaround is `--source paste` where the operator pastes content,
but this loses document structure and makes extraction harder.

**Impact**: The agent handles pasted content correctly but the extraction
quality drops compared to structured web content. Tables, figures, and
appendices are often lost in paste operations.

**Recommendation**: Add a PDF ingestion path: operator downloads the report
as PDF, provides it as a file attachment. INTEL_AGENT uses the pdf-reading
skill to extract structured content. This preserves tables, figures, and
appendices that paste operations lose. The `--source file` option should be
added to the `/intel-scenario` command.

### 6. ATT&CK Technique Validation Is Not Automated

**Problem**: The brief includes ATT&CK technique IDs but there is no automated
check that the IDs are valid against the current ATT&CK version (Enterprise v15,
ICS v2). Typos in technique IDs (T1598.003 vs T1589.003) would propagate through
the pipeline undetected.

**Impact**: Low probability but high annoyance. An invalid technique ID in a
scenario card undermines instructor credibility.

**Recommendation**: Add a quality gate in the INTEL_AGENT extraction that
validates technique IDs against a local copy of the ATT&CK STIX bundle.
The MITRE ATT&CK STIX data is freely downloadable and can be queried
programmatically. This is a small addition to the quality gate checklist.

---

## Builder Agent Handoff Assessment

### Can the builder agents construct a working scenario from the brief alone?

| Layer | Builder Agent | Handoff Quality | Notes |
|-------|--------------|-----------------|-------|
| 1 — Attack Chain | ORCHESTRATOR | ✅ Complete | Sequenced phases with routing directives |
| 2 — Topology | INFRA_AGENT | ⚠️ Source-dependent | Strong when source describes topology; requires inference for cloud-focused campaigns |
| 3 — Infrastructure | INFRA_AGENT | ✅ Complete | VM specs, template IDs, IP addresses, Ansible roles all specified |
| 3 — OT/ICS | SCADA_AGENT | ✅ Complete (when applicable) | Protocol, port, register maps specified; N/A for IT-only scenarios |
| 4 — Artifacts | INFRA_AGENT (Ansible) | ✅ Complete | File paths, staging methods, Ansible role references |
| 5 — Dressing | CONTENT_AGENT (new) | ✅ Complete (now) | Content briefs are detailed; CONTENT_AGENT generates the files |
| 5 — Dressing (AD) | INFRA_AGENT (Ansible) | ✅ Complete | OU structure, users, SPNs, password policies specified |
| — Documentation | DOCS_AGENT | ✅ Complete | Scenario card metadata, source citations, suggested ID/name |
| — Security Review | SECURITY_AGENT | ✅ Complete | ATT&CK technique tables, intentional vulnerability lists |

### Answer: Yes, with two caveats.

1. **Source quality determines brief quality.** A thin source (ATT&CK technique
   page with no incident context) produces a thin brief with gaps in Layers 2,
   4, and 5. A rich source (detailed IR case study) produces a brief that the
   builder agents can execute end-to-end without instructor intervention.

2. **Cloud-native components require instructor action.** The pipeline automates
   everything that runs on Proxmox. Cloud tenant provisioning (M365, Azure AD,
   GWS) is outside the pipeline's scope and requires manual setup documented
   in the instructor guide.

---

## Recommended Priority Actions

| Priority | Action | Owner | Effort |
|----------|--------|-------|--------|
| 1 | Integrate CONTENT_AGENT into ORCHESTRATOR routing | ORCHESTRATOR update | Low — add routing rule for Layer 5 |
| 2 | Add `/content` command to CLAUDE.md agent routing table | DOCS_AGENT | Low — documentation update |
| 3 | Update ORCHESTRATOR.md agent roster with CONTENT_AGENT | DOCS_AGENT | Low — documentation update |
| 4 | Build simulated artifact template library | CONTENT_AGENT | Medium — 4-5 base templates |
| 5 | Add `--source file` PDF ingestion path to `/intel-scenario` | INTEL_AGENT update | Medium — new source handling path |
| 6 | Add ATT&CK STIX validation to quality gates | INTEL_AGENT update | Low — query against local STIX bundle |
| 7 | Write source selection guide for operators | DOCS_AGENT | Low — 1-page reference |
| 8 | Evaluate M365 E5 dev tenant for cloud scenarios | Instructor decision | Manual — outside pipeline |
