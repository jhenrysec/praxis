#!/usr/bin/env bash
# lab-env.sh — Source this file to configure the lab environment
# Usage: source ./lab-env.sh
# NEVER commit a filled-out version of this file to git.
#
# Copy to lab-env.local.sh, fill in values, and add lab-env.local.sh to .gitignore

set -a  # auto-export all variables

# ── Proxmox ──────────────────────────────────────────────────────────────────
export PROXMOX_HOST="192.168.1.50"
export PROXMOX_VE_ENDPOINT="https://192.168.1.50:8006/"
export PROXMOX_VE_INSECURE="true"
# Set these — never hardcode:
export PROXMOX_VE_API_TOKEN_ID="terraform@pve!terraform"
export PROXMOX_VE_API_TOKEN_SECRET="217d493f-e726-47e1-b7e5-82b07a408e99"

# ── Packer ───────────────────────────────────────────────────────────────────
export PKR_VAR_proxmox_token="${PROXMOX_VE_API_TOKEN_SECRET}"
export PKR_VAR_ssh_public_key="$(cat ~/.ssh/lab_key.pub)"

# ── Terraform ────────────────────────────────────────────────────────────────
export TF_VAR_proxmox_api_token="${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}"
export TF_CLI_ARGS_plan="-compact-warnings"
export TF_CLI_ARGS_apply="-compact-warnings"

# ── Ansible ──────────────────────────────────────────────────────────────────
export ANSIBLE_HOST_KEY_CHECKING="False"
export ANSIBLE_PRIVATE_KEY_FILE="${HOME}/.ssh/lab_key"
export ANSIBLE_REMOTE_USER="ansible"

# ── Lab network constants (safe to commit) ───────────────────────────────────
export LAB_MGMT_NET="192.168.1.0/24"
export LAB_RED_NET="10.10.1.0/24"
export LAB_BLUE_NET="10.10.2.0/24"
export LAB_OT_NET="192.168.100.0/24"

# ── Verify Proxmox connectivity ──────────────────────────────────────────────
if [[ -n "${PROXMOX_VE_API_TOKEN_ID}" && -n "${PROXMOX_VE_API_TOKEN_SECRET}" ]]; then
  RESULT=$(curl -s -k -o /dev/null -w "%{http_code}" \
    -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}" \
    "${PROXMOX_VE_ENDPOINT}api2/json/version" 2>/dev/null)
  if [[ "$RESULT" == "200" ]]; then
    echo "✅ Proxmox API: connected to ${PROXMOX_HOST}"
  else
    echo "⚠️  Proxmox API: HTTP ${RESULT} — check credentials and host"
  fi
else
  echo "ℹ️  Proxmox credentials not set — edit lab-env.local.sh and source it"
fi

set +a
echo "✅ Lab environment loaded"
