# Phase 5: Terraform Usage

**Time required**: ~15 minutes (configuration only — modules are pre-built)
**Prerequisite**: Phases 1–4 (Proxmox host + templates built)
**Result**: Terraform modules ready, scenarios deployable

---

## 1. Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
proxmox_node         = "pve01"
proxmox_endpoint     = "https://192.168.1.50:8006/"
ssh_public_key_path  = "~/.ssh/lab_key.pub"
ssh_private_key_path = "~/.ssh/lab_key"
datastore            = "local-zfs"
```

Terraform authenticates via environment variables (set in `scripts/lab-env.local.sh`):
```bash
export PROXMOX_VE_ENDPOINT="https://192.168.1.50:8006/"
export PROXMOX_VE_API_TOKEN="terraform@pve!terraform=<token>"
```

## 2. Module Architecture

### `modules/vm_clone`
Linked-clone module for all VMs. Creates VMs from templates with:
- Cloud-init configuration (Linux) or WinRM-ready (Windows)
- Dual-NIC support for jump boxes and dual-homed hosts
- Tag-based organization (scenario, zone, lab)
- Lifecycle rules to prevent replacement on IP/MAC drift

### `modules/network_segment`
Per-slot IP and VLAN calculator. Given a slot number (1–20), computes:
- Red zone: `10.10.(2N-1).0/24`
- Blue zone: `10.10.(2N).0/24`
- OT zone: `192.168.(100+N).0/24`
- VM ID base: `200 + (N-1) * 10`

### `modules/scada_node`
Convenience wrapper around `vm_clone` with OT-zone defaults. Adds SCADA-specific tags and validation for roles: `plc`, `hmi`, `historian`, `rtu`, `ems`, `gateway`.

## 3. Deploy a Scenario

### Using deploy.sh (recommended)

```bash
./scripts/deploy.sh
# Interactive menu — select scenario and slot number
```

### Manual Terraform workflow

```bash
cd terraform/scenarios/scada_modbus_recon

# Initialize
terraform init

# Create/select workspace for slot
terraform workspace new student-slot-01 2>/dev/null || terraform workspace select student-slot-01

# Plan
terraform plan -var-file=terraform.tfvars -var="slot_number=1"

# Apply
terraform apply -var-file=terraform.tfvars -var="slot_number=1" -auto-approve
```

### View outputs (access sheet)

```bash
terraform output -json access_sheet
```

## 4. Destroy a Scenario

```bash
./scripts/destroy.sh scada_modbus_recon

# Or manually:
cd terraform/scenarios/scada_modbus_recon
terraform workspace select student-slot-01
terraform destroy -var-file=terraform.tfvars -var="slot_number=1" -auto-approve
```

## 5. Multi-Slot Deployment

Deploy the same scenario to multiple slots:

```bash
for SLOT in 1 2 3 4 5; do
  cd terraform/scenarios/cred_access_kerberoasting
  terraform workspace new student-slot-$(printf '%02d' $SLOT) 2>/dev/null \
    || terraform workspace select student-slot-$(printf '%02d' $SLOT)
  terraform apply -var-file=terraform.tfvars -var="slot_number=$SLOT" -auto-approve
done
```

## 6. VM ID Allocation

| Range | Purpose |
|---|---|
| 100–149 | Templates (Packer-built) |
| 200–399 | Scenario VMs (Terraform-managed, 10 per slot) |
| 900–999 | Test/scratch VMs |

---

**Next**: [05_ANSIBLE_ROLES.md](05_ANSIBLE_ROLES.md) — Post-deploy configuration with Ansible
