# /status — Project Status Report

Generate a complete current-state snapshot of the lab build.

## What to Report

### 1. Read PROJECT_STATE.md
Show the current phase completion checkboxes and any active/blocked tasks.

### 2. Scan the repository structure
```bash
find . -maxdepth 3 -name "*.tf" -o -name "*.pkr.hcl" -o -name "*.yml" | grep -v node_modules | grep -v .terraform | sort
```
Count: scenarios built, templates written, roles written, docs created.

### 3. Check tool availability (on the current machine)
```bash
terraform version 2>/dev/null || echo "NOT INSTALLED"
packer version 2>/dev/null || echo "NOT INSTALLED"
ansible --version 2>/dev/null | head -1 || echo "NOT INSTALLED"
node --version 2>/dev/null || echo "NOT INSTALLED"
go version 2>/dev/null || echo "NOT INSTALLED"
```

### 4. Check Proxmox connectivity (if credentials are available)
```bash
curl -s -k -H "Authorization: PVEAPIToken=${PROXMOX_API_TOKEN}" \
  https://${PROXMOX_HOST}:8006/api2/json/version 2>/dev/null | jq '.data.version' || echo "Proxmox not reachable"
```

### 5. Read last 5 CHANGELOG.md entries
Show recent changes to confirm documentation is current.

### 6. Report what's next
Based on the phase completion state, identify the next un-completed phase and suggest the command to run it.

## Output Format

```
╔══════════════════════════════════════════════════════════╗
║        VULN LAB — PROJECT STATUS                         ║
╠══════════════════════════════════════════════════════════╣
║ PHASE COMPLETION                                         ║
║ ✅ Phase 1: Proxmox config                              ║
║ ✅ Phase 2: ZFS storage                                 ║
║ 🔄 Phase 3: Network bridges (in progress)               ║
║ ⬜ Phase 4-10: Not started                              ║
╠══════════════════════════════════════════════════════════╣
║ ARTIFACTS BUILT                                          ║
║ Templates:   X / 8 expected                              ║
║ TF modules:  X / 3 expected                              ║
║ Scenarios:   X / 4 initial                               ║
║ Ansible roles: X / 8 expected                            ║
║ Docs pages:  X created                                   ║
╠══════════════════════════════════════════════════════════╣
║ TOOLS ON THIS MACHINE                                    ║
║ Terraform: X.X.X  Packer: X.X.X  Ansible: X.X.X          ║
║ Node: X.X.X  Go: X.X.X  Proxmox: reachable/not           ║
╠══════════════════════════════════════════════════════════╣
║ RECENT CHANGES (last 3)                                  ║
║ ...from CHANGELOG.md                                     ║
╠══════════════════════════════════════════════════════════╣
║ NEXT STEP                                                ║
║ Run: /phase X                                            ║
╚══════════════════════════════════════════════════════════╝
```

Update PROJECT_STATE.md with current status after generating this report.
