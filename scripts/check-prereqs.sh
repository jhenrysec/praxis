#!/usr/bin/env bash
# scripts/check-prereqs.sh
# Validates management workstation has all required tools before /phase 1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

PASS=0; FAIL=0; WARN=0

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║             Lab — Prerequisites Check            ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Helper functions ──────────────────────────────────────────
pass() { echo -e "  ${GREEN}✅ $1${RESET}"; ((PASS++)); }
fail() { echo -e "  ${RED}❌ $1${RESET}"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${RESET}"; ((WARN++)); }

check_cmd() {
  local label=$1 cmd=$2
  if command -v "$cmd" &>/dev/null; then
    local ver
    ver=$(${cmd} --version 2>/dev/null | head -1 | grep -oP '[\d]+\.[\d]+[\.\d]*' | head -1)
    pass "${label}: ${ver:-found}"
  else
    fail "${label}: NOT INSTALLED"
  fi
}

check_file() {
  local label=$1 path=$2
  if [[ -f "$path" ]]; then
    pass "${label}: found"
  else
    warn "${label}: NOT FOUND — ${path}"
  fi
}

check_env() {
  local label=$1 var=$2
  if [[ -n "${!var:-}" ]]; then
    pass "${label}: set"
  else
    warn "${label}: NOT SET"
  fi
}

# ── Required tools ────────────────────────────────────────────
echo -e "${BOLD}── Required Tools ──────────────────────────────────${RESET}"

check_cmd "Node.js"    "node"
check_cmd "Git"        "git"
check_cmd "jq"         "jq"
check_cmd "curl"       "curl"
check_cmd "Go"         "go"

# Terraform
if command -v terraform &>/dev/null; then
  ver=$(terraform version 2>/dev/null | head -1 | grep -oP '[\d]+\.[\d]+[\.\d]*' | head -1)
  pass "Terraform: ${ver}"
else
  fail "Terraform: NOT INSTALLED"
fi

# Packer
if command -v packer &>/dev/null; then
  ver=$(packer version 2>/dev/null | head -1 | grep -oP '[\d]+\.[\d]+[\.\d]*' | head -1)
  pass "Packer: ${ver}"
else
  fail "Packer: NOT INSTALLED"
fi

# Ansible
if command -v ansible &>/dev/null; then
  ver=$(ansible --version 2>/dev/null | head -1 | grep -oP '[\d]+\.[\d]+[\.\d]*' | head -1)
  pass "Ansible: ${ver}"
else
  fail "Ansible: NOT INSTALLED"
fi

# Python3
if command -v python3 &>/dev/null; then
  ver=$(python3 --version 2>/dev/null | grep -oP '[\d]+\.[\d]+[\.\d]*' | head -1)
  pass "Python 3: ${ver}"
else
  fail "Python 3: NOT INSTALLED"
fi

# Claude Code — hardcoded since it hangs in non-interactive shells
if command -v claude &>/dev/null; then
  pass "Claude Code: installed (run 'claude --version' to confirm)"
else
  fail "Claude Code: NOT INSTALLED — run: sudo npm install -g @anthropic-ai/claude-code"
fi

echo ""

# ── Python packages ───────────────────────────────────────────
echo -e "${BOLD}── Python Packages ─────────────────────────────────${RESET}"

if pip3 show pywinrm &>/dev/null; then
  ver=$(pip3 show pywinrm 2>/dev/null | grep ^Version | grep -oP '[\d]+\.[\d]+[\.\d]*')
  pass "pywinrm: ${ver}"
else
  fail "pywinrm: NOT INSTALLED — run: pip3 install --user --break-system-packages pywinrm"
fi

if pipx list 2>/dev/null | grep -q ansible-lint; then
  pass "ansible-lint: installed via pipx"
elif command -v ansible-lint &>/dev/null; then
  pass "ansible-lint: installed"
else
  warn "ansible-lint: NOT INSTALLED — run: pipx install ansible-lint"
fi

echo ""

# ── Ansible collections ───────────────────────────────────────
echo -e "${BOLD}── Ansible Collections ──────────────────────────────${RESET}"

for collection in ansible.windows microsoft.ad community.general community.postgresql; do
  if ansible-galaxy collection list 2>/dev/null | grep -q "${collection}"; then
    pass "${collection}: installed"
  else
    warn "${collection}: NOT INSTALLED — run: ansible-galaxy collection install ${collection}"
  fi
done

echo ""

# ── SSH keys ──────────────────────────────────────────────────
echo -e "${BOLD}── SSH Keys ─────────────────────────────────────────${RESET}"
check_file "Lab private key" "$HOME/.ssh/lab_key"
check_file "Lab public key"  "$HOME/.ssh/lab_key.pub"

echo ""

# ── Claude Code config ────────────────────────────────────────
echo -e "${BOLD}── Claude Code Config ───────────────────────────────${RESET}"
check_file "Global CLAUDE.md"      "$HOME/.claude/CLAUDE.md"
check_file ".claude/settings.json" "$(pwd)/.claude/settings.json"
check_file "CLAUDE.md"             "$(pwd)/CLAUDE.md"

echo ""

# ── Credentials ───────────────────────────────────────────────
echo -e "${BOLD}── Credentials (from lab-env.local.sh) ─────────────${RESET}"
if [[ -f "$(pwd)/scripts/lab-env.local.sh" ]]; then
  source "$(pwd)/scripts/lab-env.local.sh" 2>/dev/null || true
fi

check_env "Proxmox API Token ID"     "PROXMOX_VE_API_TOKEN_ID"
check_env "Proxmox API Token Secret" "PROXMOX_VE_API_TOKEN_SECRET"
check_env "Proxmox Endpoint"         "PROXMOX_VE_ENDPOINT"

echo ""

# ── Proxmox connectivity ──────────────────────────────────────
echo -e "${BOLD}── Proxmox Connectivity ─────────────────────────────${RESET}"
if [[ -n "${PROXMOX_VE_ENDPOINT:-}" && -n "${PROXMOX_VE_API_TOKEN_ID:-}" && -n "${PROXMOX_VE_API_TOKEN_SECRET:-}" ]]; then
  HTTP_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" \
    -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}" \
    "${PROXMOX_VE_ENDPOINT}api2/json/version" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    pass "Proxmox API: reachable (HTTP 200)"
  else
    fail "Proxmox API: HTTP ${HTTP_CODE} — check credentials and host"
  fi
else
  warn "Proxmox connectivity: skipped (credentials not set)"
fi

echo ""

# ── Summary ───────────────────────────────────────────────────
echo -e "${BOLD}── Summary ──────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}✅ Passed: ${PASS}${RESET}"
[[ $WARN -gt 0 ]] && echo -e "  ${YELLOW}⚠️  Warnings: ${WARN}${RESET}"
[[ $FAIL -gt 0 ]] && echo -e "  ${RED}❌ Failed: ${FAIL}${RESET}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}${BOLD}Not ready. Fix the failed items above, then re-run.${RESET}"
  echo ""
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}Ready with warnings. Address before running /phase 4.${RESET}"
  echo -e "${GREEN}You can proceed with: ${BOLD}claude${RESET}${GREEN} → ${BOLD}/phase 1${RESET}"
else
  echo -e "${GREEN}${BOLD}All checks passed. Run: claude → /phase 1${RESET}"
fi
echo ""
