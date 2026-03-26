# /snapshot — Take Baseline Snapshots of All Scenario VMs

Take named baseline snapshots of all running VMs in the current scenario workspace.

Scenario workspace: $ARGUMENTS
(Pass the terraform workspace name, e.g. "scada_modbus_recon". Leave blank to snapshot all running VMs.)

## Process

### 1. Get running VM list
```bash
# From Proxmox API or qm list
qm list | grep running | awk '{print $1, $2}'
# Or via Terraform outputs:
terraform output -json | jq '.access_sheet.value'
```

### 2. Take named snapshot for each VM
```bash
SNAPSHOT_NAME="baseline-$(date +%Y%m%d)"
DESCRIPTION="Baseline snapshot before scenario run — $(date)"

for VMID in <vm_ids>; do
  echo "Snapshotting VM $VMID as $SNAPSHOT_NAME"
  qm snapshot "$VMID" "$SNAPSHOT_NAME" --description "$DESCRIPTION" --vmstate 0
  echo "✅ VM $VMID → $SNAPSHOT_NAME"
done
```

### 3. Verify snapshots
```bash
for VMID in <vm_ids>; do
  qm listsnapshot "$VMID"
done
```

### 4. Log the snapshot event
/docs "Baseline snapshots created for scenario $ARGUMENTS: $SNAPSHOT_NAME"

---

# /rollback — Roll All Scenario VMs Back to Baseline

Roll every VM in a scenario back to its named baseline snapshot.

Scenario and snapshot: $ARGUMENTS
(Format: "<workspace_name> <snapshot_name>", e.g. "scada_modbus_recon baseline-20250601")

## Process

### 1. Stop all VMs first (snapshot rollback requires VM to be stopped)
```bash
for VMID in <vm_ids>; do
  qm shutdown "$VMID" --timeout 30 || qm stop "$VMID"
done
```

### 2. Roll back each VM
```bash
for VMID in <vm_ids>; do
  echo "Rolling back VM $VMID to $SNAPSHOT_NAME"
  qm rollback "$VMID" "$SNAPSHOT_NAME"
  echo "✅ VM $VMID → rolled back"
done
```

### 3. Start all VMs
```bash
for VMID in <vm_ids>; do
  qm start "$VMID"
  sleep 5  # Stagger starts to avoid storage I/O spike
done
```

### 4. Verify VMs are running
```bash
qm list | grep -E "$(echo "<vm_ids>" | tr ' ' '|')"
```

### 5. Log the rollback
/docs "Rollback complete: scenario $ARGUMENTS rolled back to $SNAPSHOT_NAME at $(date)"

⚠️ RISK: Rollback is destructive — all changes since the snapshot are lost. This is intentional for lab reset purposes.
