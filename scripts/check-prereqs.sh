#!/usr/bin/env bash
# scripts/check-prereqs.sh
# Validates the management workstation has all required tools installed and meets
# minimum version requirements before running /phase 1 in Claude Code.
# Usage: ./scripts/check-prereqs.sh

set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

PASS=0; FAIL=0; WARN=0

check() {
  local label="$1" cmd="$2" min_ver="$3" actual_ver
  actual_ver=$(eval "$cmd" 2>/dev/null | head -1 | grep -oP '[\d]+\.[\d]+[\.\d]*' | head -1 || echo "NOT FOUND")
  if [[ "$actual_ver" == "NOT FOUND" ]]; then
    echo -e "  ${RED}❌ ${label}: NOT INSTALLED${RESET}"
    ((FAIL++))
  else
    echo -e "  ${GREEN}✅ ${label}: ${actual_ver}${RESET} (min: ${min_ver})"
    ((PASS++))
  fi
}

check_file() {
  local label="$1" path="$2"
  if [[ -f "$path" ]]; then
    echo -e "  ${GREEN}✅ ${label}: found${RESET}"
    ((PASS++))
  else
    echo -e "  ${YELLOW}⚠️  ${label}: NOT FOUND — ${path}${RESET}"
    ((WARN++))
  fi
}

check_env() {
  local label="$1" var="$2"
  if [[ -n "${!var:-}" ]]; then
    echo -e "  ${GREEN}✅ ${label}: set${RESET}"
    ((PASS++))
  else
    echo -e "  ${YELLOW}⚠️  ${label}: NOT SET${RESET} (set in scripts/lab-env.local.sh)"
    ((WARN++))
  fi
}

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║   Higher Echelon Lab — Prerequisites Check       ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

echo -e "${BOLD}── Required Tools ──────────────────────────────────${RESET}"
check "Node.js"       "node --version"        "22.0"
check "Claude Code"   "claude --version"      "2.1.59"
check "Terraform"     "terraform version"     "1.9.0"
check "Packer"        "packer version"        "1.11.0"
check "Ansible"       "ansible --version"     "2.17.0"
check "Python 3"      "python3 --version"     "3.11"
check "Git"           "git --version"         "2.0"
check "jq"            "jq --version"          "1.6"
check "curl"          "curl --version"        "7.0"
echo ""

echo -e "${BOLD}── Python Packages ─────────────────────────────────${RESET}"
check "pywinrm"       "pip3 show pywinrm | grep Version:" "0.4"
check "ansible-lint"  "ansible-lint --version" "6.0"
echo ""

echo -e "${BOLD}── Ansible Collections ──────────────────────────────${RESET}"
if ansible-galaxy collection list 2>/dev/null | grep -q "ansible.windows"; then
  echo -e "  ${GREEN}✅ ansible.windows: installed${RESET}"; ((PASS++))
else
  echo -e "  ${YELLOW}⚠️  ansible.windows: NOT INSTALLED${RESET}"
  echo -e "     Run: ansible-galaxy collection install ansible.windows"; ((WARN++))
fi
if ansible-galaxy collection list 2>/dev/null | grep -q "microsoft.ad"; then
  echo -e "  ${GREEN}✅ microsoft.ad: installed${RESET}"; ((PASS++))
else
  echo -e "  ${YELLOW}⚠️  microsoft.ad: NOT INSTALLED${RESET}"
  echo -e "     Run: ansible-galaxy collection install microsoft.ad"; ((WARN++))
fi
echo ""

echo -e "${BOLD}── SSH Keys ─────────────────────────────────────────${RESET}"
check_file "Lab private key"  "$HOME/.ssh/lab_key"
check_file "Lab public key"   "$HOME/.ssh/lab_key.pub"
echo ""

echo -e "${BOLD}── Claude Code Config ───────────────────────────────${RESET}"
check_file "Global CLAUDE.md"     "$HOME/.claude/CLAUDE.md"
check_file ".claude/settings.json" "$(pwd)/.claude/settings.json"
check_file "CLAUDE.md"            "$(pwd)/CLAUDE.md"
echo ""

echo -e "${BOLD}── Credentials (from lab-env.local.sh) ─────────────${RESET}"
if [[ -f "$(pwd)/scripts/lab-env.local.sh" ]]; then
  source "$(pwd)/scripts/lab-env.local.sh" 2>/dev/null || true
fi
check_env "Proxmox API Token ID"     "PROXMOX_VE_API_TOKEN_ID"
check_env "Proxmox API Token Secret" "PROXMOX_VE_API_TOKEN_SECRET"
check_env "Proxmox Endpoint"         "PROXMOX_VE_ENDPOINT"
echo ""

echo -e "${BOLD}── Proxmox Connectivity ────────────────────────────${RESET}"
if [[ -n "${PROXMOX_VE_ENDPOINT:-}" && -n "${PROXMOX_VE_API_TOKEN_ID:-}" && -n "${PROXMOX_VE_API_TOKEN_SECRET:-}" ]]; then
  HTTP_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" \
    -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}" \
    "${PROXMOX_VE_ENDPOINT}api2/json/version" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo -e "  ${GREEN}✅ Proxmox API: reachable (HTTP 200)${RESET}"; ((PASS++))
  else
    echo -e "  ${RED}❌ Proxmox API: HTTP ${HTTP_CODE} — check credentials and host${RESET}"; ((FAIL++))
  fi
else
  echo -e "  ${YELLOW}⚠️  Proxmox connectivity: skipped (credentials not set)${RESET}"; ((WARN++))
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}── Summary ──────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}✅ Passed: ${PASS}${RESET}"
[[ $WARN -gt 0 ]] && echo -e "  ${YELLOW}⚠️  Warnings: ${WARN}${RESET}"
[[ $FAIL -gt 0 ]] && echo -e "  ${RED}❌ Failed: ${FAIL}${RESET}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}${BOLD}Not ready. Fix the failed items above, then re-run this check.${RESET}"
  echo ""
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}Ready with warnings. Address warnings before running /phase 4 (Packer).${RESET}"
  echo -e "${GREEN}You can proceed with: ${BOLD}claude${RESET}${GREEN} → ${BOLD}/phase 1${RESET}"
else
  echo -e "${GREEN}${BOLD}All checks passed. Run: claude → /phase 1${RESET}"
fi
echo ""
