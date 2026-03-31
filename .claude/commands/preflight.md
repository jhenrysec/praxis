# /preflight — Pre-Build Infrastructure Verification

Verify all infrastructure dependencies exist before building a scenario.

Brief to verify: $ARGUMENTS

## Purpose

Before INFRA_AGENT starts building a scenario from an intel brief, this check verifies
that every required Packer template, ISO, network bridge, and tool version exists and
is available. This prevents build failures 30 minutes into a Terraform apply.

## Execution Protocol

1. **Parse the intel brief**
   Read the specified YAML file from `intel_briefs/`.
   Extract every `infrastructure.assets[].substitution.template` value.
   Extract every `topology_context.lab_zone_mapping[].lab_bridge` value.
   Extract VM resource requirements (total CPU, memory, disk).

2. **Check template availability on Proxmox**
   ```bash
   # Query Proxmox for existing templates
   qm list | grep -E "template|TEMPLATE" || \
   curl -s -k -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}" \
     "${PROXMOX_VE_ENDPOINT}api2/json/nodes/pve01/qemu" | \
     jq -r '.data[] | select(.template == 1) | "\(.vmid) \(.name)"'
   ```
   
   For each required template:
   - Check if it exists on Proxmox
   - If NOT found: check if the Packer template `.pkr.hcl` file exists in `packer/templates/`
   - If Packer file exists but template not built: flag as NEEDS_BUILD
   - If Packer file doesn't exist: flag as MISSING_TEMPLATE — hard stop

3. **Check ISO availability for missing templates**
   If any templates need building, run the ISO check:
   ```bash
   ./scripts/check-isos.sh --template <template_name>
   ```
   
   If ISOs are missing:
   - Auto-downloadable: offer to download
   - Manual download required: print instructions and STOP

4. **Check network bridges**
   ```bash
   # Verify all required bridges exist
   ip link show | grep -oP 'vmbr\d+'
   # Or via API:
   curl -s -k -H "Authorization: ..." \
     "${PROXMOX_VE_ENDPOINT}api2/json/nodes/pve01/network" | \
     jq -r '.data[] | select(.type == "bridge") | .iface'
   ```
   
   Compare against required bridges from the brief's `lab_zone_mapping`.

5. **Check host resource capacity**
   ```bash
   # Available resources
   curl -s -k -H "Authorization: ..." \
     "${PROXMOX_VE_ENDPOINT}api2/json/nodes/pve01/status" | \
     jq '{
       cpu_total: .data.cpuinfo.cpus,
       cpu_used: (.data.cpu * .data.cpuinfo.cpus | floor),
       mem_total_gb: (.data.memory.total / 1073741824 | floor),
       mem_used_gb: (.data.memory.used / 1073741824 | floor),
       storage_free_gb: (.data.rootfs.free / 1073741824 | floor)
     }'
   ```
   
   Calculate total resources needed for the scenario's VMs.
   Verify host has enough headroom (leave 8GB RAM, 4 cores, 50GB disk for host).

6. **Check tool versions**
   ```bash
   terraform version | head -1
   packer version
   ansible --version | head -1
   ```
   Compare against minimum versions in `docs/VERSION_MANIFEST.md`.

7. **Check Ansible role availability**
   For each `infrastructure.assets[].substitution.ansible_role`:
   - Check if role directory exists in `ansible/roles/<role_name>/`
   - If not: check `scenarios/*/ansible/roles/<role_name>/`
   - If not found anywhere: flag as NEEDS_CREATION

8. **Generate preflight report**

   ```
   ═══════════════════════════════════════════════════════════════
   PREFLIGHT CHECK: <scenario_name>
   ═══════════════════════════════════════════════════════════════
   
   ── TEMPLATES ────────────────────────────────────────────────
   ✅ tpl-kali-2024 (VM 101) — exists on Proxmox
   ✅ tpl-win-server-2022 (VM 102) — exists on Proxmox
   ❌ tpl-openplc (VM 130) — NOT FOUND
      → Packer file: packer/templates/openplc.pkr.hcl ✅ exists
      → ISOs needed: debian-12.9.0-amd64-netinst.iso ✅ on Proxmox
      → Action: run `packer build` for this template (~15 min)
   
   ── NETWORK BRIDGES ─────────────────────────────────────────
   ✅ vmbr1 — exists
   ✅ vmbr2 — exists
   ✅ vmbr3 — exists
   
   ── HOST RESOURCES ──────────────────────────────────────────
   Scenario needs: 10 cores, 16 GB RAM, 240 GB disk
   Host available: 24 cores, 48 GB RAM free, 1.2 TB disk free
   ✅ Sufficient resources
   
   ── TOOL VERSIONS ───────────────────────────────────────────
   ✅ Terraform 1.14.2 (min: 1.14.0)
   ✅ Packer 1.15.0 (min: 1.15.0)
   ✅ Ansible 2.20.1 (min: 2.19.0)
   
   ── ANSIBLE ROLES ───────────────────────────────────────────
   ✅ ad-domain-controller — ansible/roles/
   ✅ openplc-configure — ansible/roles/
   ❌ stage-dressing-ews — NOT FOUND
      → Action: will be created during scenario build
   
   ── VERDICT ─────────────────────────────────────────────────
   🟢 READY: All critical dependencies met
        (1 template needs building, 1 Ansible role needs creation)
        Estimated build time: ~20 minutes before scenario is deployable
   
   🟡 BLOCKED: Missing template with no Packer file
        Action: create Packer template first, then re-run preflight
   
   🔴 BLOCKED: Missing ISOs that require manual download
        Action: download ISOs, upload to Proxmox, then re-run preflight
   ═══════════════════════════════════════════════════════════════
   ```

9. **If READY**: proceed to build — pass the preflight results to ORCHESTRATOR
10. **If BLOCKED**: stop and report exactly what the instructor needs to do

## Automatic Integration

This check runs automatically as part of `/intel-scenario` (after the brief is
generated, before the orchestrator handoff) and as part of `/orchestrate` when
building from an intel brief. It can also be run standalone:

```
/preflight intel_briefs/volt_typhoon_ics_pivot_2025-06-01.yaml
```
