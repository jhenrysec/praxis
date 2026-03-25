#!/usr/bin/env bash
# scripts/reset-scenario.sh
# Roll back all VMs in a scenario to their baseline snapshot.
# Faster than destroy + redeploy for resetting between student groups.
# Usage: ./scripts/reset-scenario.sh <scenario_name> [snapshot_name]
#
# Requires: qm command (run on Proxmox host, or via SSH)
# See also: /rollback command in Claude Code

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <scenario_name> [snapshot_name]"
  echo "Example: $0 scada_modbus_recon baseline-20250601"
  exit 1
fi

SCENARIO="$1"
SNAPSHOT="${2:-baseline}"

echo ""
echo -e "${CYAN}${BOLD}Resetting scenario: ${SCENARIO}${RESET}"
echo -e "Target snapshot:    ${SNAPSHOT}"
echo ""

# Get VM IDs from Terraform outputs
TF_DIR="${REPO_ROOT}/terraform/scenarios/${SCENARIO}"
if [[ ! -d "$TF_DIR" ]]; then
  echo -e "${RED}Scenario directory not found: ${TF_DIR}${RESET}"; exit 1
fi

cd "$TF_DIR"
terraform workspace select "${SCENARIO}" 2>/dev/null || { echo -e "${RED}Workspace ${SCENARIO} not found — is it deployed?${RESET}"; exit 1; }

# Extract VM IDs from state
VM_IDS=$(terraform state list 2>/dev/null | grep "proxmox_virtual_machine" | while read -r resource; do
  terraform state show "$resource" 2>/dev/null | grep "^\s*vm_id\s*=" | awk '{print $3}'
done)

if [[ -z "$VM_IDS" ]]; then
  echo -e "${YELLOW}No VMs found in Terraform state for this scenario.${RESET}"; exit 1
fi

echo -e "${BOLD}VMs to reset:${RESET}"
echo "$VM_IDS" | while read -r vmid; do echo "  VM ${vmid}"; done
echo ""

echo -e "${YELLOW}This will roll back ALL listed VMs to snapshot '${SNAPSHOT}'.${RESET}"
echo -e "${RED}All student work since last snapshot will be lost.${RESET}"
echo -n "Continue? [y/N]: "
read -r CONFIRM
[[ "${CONFIRM,,}" != "y" ]] && { echo "Cancelled."; exit 0; }
echo ""

# Execute via SSH on Proxmox host or directly if running on Proxmox
PVE_CMD=""
if command -v qm &>/dev/null; then
  PVE_CMD="qm"
elif [[ -n "${PROXMOX_HOST:-}" ]]; then
  PVE_CMD="ssh root@${PROXMOX_HOST} qm"
else
  echo -e "${RED}Cannot find qm command. Set PROXMOX_HOST or run this script on the Proxmox host.${RESET}"
  exit 1
fi

echo "$VM_IDS" | while read -r VMID; do
  [[ -z "$VMID" ]] && continue
  echo -e "${CYAN}→ Stopping VM ${VMID}...${RESET}"
  $PVE_CMD shutdown "$VMID" --timeout 30 2>/dev/null || $PVE_CMD stop "$VMID" 2>/dev/null || true

  echo -e "${CYAN}→ Rolling back VM ${VMID} to snapshot '${SNAPSHOT}'...${RESET}"
  if $PVE_CMD rollback "$VMID" "$SNAPSHOT"; then
    echo -e "${GREEN}  ✅ VM ${VMID} rolled back${RESET}"
  else
    echo -e "${RED}  ❌ VM ${VMID} rollback failed — snapshot '${SNAPSHOT}' may not exist${RESET}"
    echo -e "     Run: ${PVCMD} listsnapshot ${VMID} to see available snapshots"
  fi

  echo -e "${CYAN}→ Starting VM ${VMID}...${RESET}"
  $PVE_CMD start "$VMID"
  sleep 5
done

echo ""
echo -e "${GREEN}${BOLD}Reset complete. VMs are starting up.${RESET}"
echo -e "Allow ~60 seconds for Windows VMs to fully boot before student access."
echo ""
