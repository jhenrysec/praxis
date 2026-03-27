#!/usr/bin/env bash
# fix-repo.sh — Apply all audit fixes to the vulnerability lab repository
# Generated: 2026-03-27
# Run from the repo root: bash fix-repo.sh
#
# This script performs:
# 1. Removes all "Higher Echelon" company name references
# 2. Updates Proxmox version references from 8.x to 9.x
# 3. Updates all software version pins to current stable
# 4. Fixes duplicate files
# 5. Updates Debian base references from Bookworm to Trixie

set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}  Vulnerability Lab — Repository Fix Script${RESET}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo ""

# ── 1. COMPANY NAME REMOVAL ─────────────────────────────────────────────────
echo -e "${BOLD}[1/5] Removing company name references...${RESET}"

# agents/BACKEND_AGENT.md
if [ -f "agents/BACKEND_AGENT.md" ]; then
  sed -i 's/Higher Echelon lab portal/the lab portal/g' agents/BACKEND_AGENT.md
  echo "  ✓ agents/BACKEND_AGENT.md"
fi

# agents/INTEL_AGENT.md
if [ -f "agents/INTEL_AGENT.md" ]; then
  sed -i 's/Higher Echelon vulnerability lab/the vulnerability lab/g' agents/INTEL_AGENT.md
  echo "  ✓ agents/INTEL_AGENT.md"
fi

# ansible/group_vars/all/main.yml
if [ -f "ansible/group_vars/all/main.yml" ]; then
  sed -i 's/lab_org: "Higher Echelon"/lab_org: "Cyber Range"/g' ansible/group_vars/all/main.yml
  echo "  ✓ ansible/group_vars/all/main.yml"
fi

# README.md — git clone URL
if [ -f "README.md" ]; then
  sed -i 's|higher-echelon-vuln-lab|vuln-lab|g' README.md
  echo "  ✓ README.md"
fi

# SETUP_GUIDE.md — git clone URL
if [ -f "SETUP_GUIDE.md" ]; then
  sed -i 's|higher-echelon-vuln-lab|vuln-lab|g' SETUP_GUIDE.md
  echo "  ✓ SETUP_GUIDE.md"
fi

# Catch any remaining references across all markdown/yaml/json files
echo "  Scanning for any remaining 'Higher Echelon' references..."
REMAINING=$(grep -rl "Higher Echelon" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v .terraform || true)
if [ -n "$REMAINING" ]; then
  echo -e "  ${YELLOW}⚠ Found additional references in:${RESET}"
  echo "$REMAINING" | while read -r f; do echo "    - $f"; done
  # Replace remaining instances
  echo "$REMAINING" | while read -r f; do
    sed -i 's/Higher Echelon, Inc\./Cyber Range/g' "$f"
    sed -i 's/Higher Echelon/Cyber Range/g' "$f"
    sed -i 's/higher-echelon/cyber-range/g' "$f"
  done
  echo "  ✓ Replaced all remaining instances"
else
  echo "  ✓ No additional references found"
fi

echo ""

# ── 2. PROXMOX VERSION UPDATES (8.x → 9.x) ─────────────────────────────────
echo -e "${BOLD}[2/5] Updating Proxmox version references to 9.x...${RESET}"

# Files that reference "Proxmox VE 8.x" or "8.3+"
FILES_PVE_VER=(
  "ORCHESTRATOR.md"
  "agents/INFRA_AGENT.md"
  "README.md"
  "SETUP_GUIDE.md"
  "docs/setup/00_PREREQUISITES.md"
)

for f in "${FILES_PVE_VER[@]}"; do
  if [ -f "$f" ]; then
    sed -i 's/Proxmox VE 8\.x/Proxmox VE 9.x/g' "$f"
    sed -i 's/Proxmox VE 8\.3+/Proxmox VE 9.1+/g' "$f"
    sed -i 's/Proxmox VE 8\.3/Proxmox VE 9.1/g' "$f"
    sed -i 's/proxmox-ve_8\.\([0-9]\)/proxmox-ve_9.1/g' "$f"
    echo "  ✓ $f"
  fi
done

# Update Debian base references
echo "  Updating Debian Bookworm → Trixie references..."
DEBIAN_FILES=$(grep -rl "Bookworm\|bookworm" --include="*.md" --include="*.yml" . 2>/dev/null | grep -v node_modules || true)
if [ -n "$DEBIAN_FILES" ]; then
  echo "$DEBIAN_FILES" | while read -r f; do
    sed -i 's/12 (Bookworm)/13 (Trixie)/g' "$f"
    sed -i 's/Debian 12/Debian 13/g' "$f"
    sed -i 's/bookworm/trixie/g' "$f"
    echo "  ✓ $f (Debian version)"
  done
fi

echo ""

# ── 3. SOFTWARE VERSION UPDATES ─────────────────────────────────────────────
echo -e "${BOLD}[3/5] Updating software version pins...${RESET}"

# Terraform version: 1.9 → 1.14
echo "  Updating Terraform version pins..."
TF_FILES=(
  "CLAUDE.md"
  "README.md"
  "SETUP_GUIDE.md"
  "docs/setup/00_PREREQUISITES.md"
  "docs/VERSION_MANIFEST.md"
  "terraform/providers.tf"
  "skills/TERRAFORM_SKILL.md"
)
for f in "${TF_FILES[@]}"; do
  if [ -f "$f" ]; then
    sed -i 's/Terraform >= 1\.9/Terraform >= 1.14/g' "$f"
    sed -i 's/>= 1\.9\.0/>= 1.14.0/g' "$f"
    sed -i 's/1\.9\.x/1.14.x/g' "$f"
    sed -i 's/1\.9+/1.14+/g' "$f"
    echo "  ✓ $f (Terraform)"
  fi
done

# bpg/proxmox provider: 0.66 → 0.99
echo "  Updating bpg/proxmox provider version..."
BGP_FILES=(
  "CLAUDE.md"
  "docs/VERSION_MANIFEST.md"
  "terraform/providers.tf"
  "skills/TERRAFORM_SKILL.md"
)
for f in "${BGP_FILES[@]}"; do
  if [ -f "$f" ]; then
    sed -i 's/>= 0\.66\.0/>= 0.99.0/g' "$f"
    sed -i 's/0\.66\.x/0.99.x/g' "$f"
    sed -i 's/>= 0\.66/>= 0.99/g' "$f"
    sed -i 's/0\.66\.3/0.99.0/g' "$f"
    echo "  ✓ $f (bpg/proxmox)"
  fi
done

# Packer: 1.11 → 1.15
echo "  Updating Packer version pins..."
PACKER_FILES=(
  "CLAUDE.md"
  "README.md"
  "SETUP_GUIDE.md"
  "docs/setup/00_PREREQUISITES.md"
  "docs/VERSION_MANIFEST.md"
  "skills/PACKER_ANSIBLE_SKILL.md"
)
for f in "${PACKER_FILES[@]}"; do
  if [ -f "$f" ]; then
    sed -i 's/Packer >= 1\.11/Packer >= 1.15/g' "$f"
    sed -i 's/>= 1\.11\.0/>= 1.15.0/g' "$f"
    sed -i 's/1\.11\.x/1.15.x/g' "$f"
    sed -i 's/1\.11+/1.15+/g' "$f"
    echo "  ✓ $f (Packer)"
  fi
done

# Ansible Core: 2.17 → 2.19
echo "  Updating Ansible Core version pins..."
ANSIBLE_FILES=(
  "CLAUDE.md"
  "README.md"
  "SETUP_GUIDE.md"
  "docs/setup/00_PREREQUISITES.md"
  "docs/VERSION_MANIFEST.md"
  "skills/PACKER_ANSIBLE_SKILL.md"
)
for f in "${ANSIBLE_FILES[@]}"; do
  if [ -f "$f" ]; then
    sed -i 's/Ansible Core >= 2\.17/Ansible Core >= 2.19/g' "$f"
    sed -i 's/>= 2\.17\.0/>= 2.19.0/g' "$f"
    sed -i 's/2\.17\.x/2.20.x/g' "$f"
    sed -i 's/ansible-core==2\.17\.\*/ansible-core>=2.19/g' "$f"
    echo "  ✓ $f (Ansible)"
  fi
done

# settings.json version pins
if [ -f ".claude/commands/settings.json" ]; then
  sed -i 's/"TERRAFORM_MIN_VERSION": "1\.9\.0"/"TERRAFORM_MIN_VERSION": "1.14.0"/g' .claude/commands/settings.json
  sed -i 's/"PACKER_MIN_VERSION": "1\.11\.0"/"PACKER_MIN_VERSION": "1.15.0"/g' .claude/commands/settings.json
  echo "  ✓ .claude/commands/settings.json"
fi

# ZFS version in VERSION_MANIFEST
if [ -f "docs/VERSION_MANIFEST.md" ]; then
  sed -i 's/ZFS | 2\.2\.x/ZFS | 2.3.x/g' docs/VERSION_MANIFEST.md
  echo "  ✓ docs/VERSION_MANIFEST.md (ZFS)"
fi

echo ""

# ── 4. FIX DUPLICATE FILES ──────────────────────────────────────────────────
echo -e "${BOLD}[4/5] Cleaning up duplicate files...${RESET}"

# Remove duplicate package.json in portal-backend/src/
if [ -f "portal-backend/src/package.json" ]; then
  rm portal-backend/src/package.json
  echo "  ✓ Removed duplicate portal-backend/src/package.json"
fi

# Remove duplicate tsconfig.json in portal-backend/src/
if [ -f "portal-backend/src/tsconfig.json" ]; then
  rm portal-backend/src/tsconfig.json
  echo "  ✓ Removed duplicate portal-backend/src/tsconfig.json"
fi

# Remove duplicate lab-env.sh at root (keep scripts/lab-env.sh)
if [ -f "lab-env.sh" ] && [ -f "scripts/lab-env.sh" ]; then
  rm lab-env.sh
  echo "  ✓ Removed duplicate root lab-env.sh (kept scripts/lab-env.sh)"
fi

echo ""

# ── 5. VERIFY RESULTS ───────────────────────────────────────────────────────
echo -e "${BOLD}[5/5] Verification scan...${RESET}"

echo "  Scanning for remaining 'Higher Echelon' references..."
HE_COUNT=$(grep -rl "Higher Echelon\|higher-echelon\|higher_echelon" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.sh" . 2>/dev/null | grep -v node_modules | grep -v .terraform | wc -l || echo "0")
if [ "$HE_COUNT" -gt 0 ]; then
  echo -e "  ${RED}✗ Found $HE_COUNT files still containing company name references:${RESET}"
  grep -rl "Higher Echelon\|higher-echelon\|higher_echelon" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.ts" --include="*.tsx" --include="*.sh" . 2>/dev/null | grep -v node_modules | grep -v .terraform | while read -r f; do echo "    - $f"; done
else
  echo -e "  ${GREEN}✓ No company name references found${RESET}"
fi

echo ""
echo "  Scanning for remaining 'Proxmox VE 8' references..."
PVE8_COUNT=$(grep -rl "Proxmox VE 8" --include="*.md" . 2>/dev/null | grep -v node_modules | wc -l || echo "0")
if [ "$PVE8_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ Found $PVE8_COUNT files still referencing PVE 8.x:${RESET}"
  grep -rl "Proxmox VE 8" --include="*.md" . 2>/dev/null | grep -v node_modules | while read -r f; do echo "    - $f"; done
else
  echo -e "  ${GREEN}✓ All Proxmox references updated to 9.x${RESET}"
fi

echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Fix script complete.${RESET}"
echo -e "${CYAN}  Review changes with: git diff${RESET}"
echo -e "${CYAN}  Commit with: git add -A && git commit -m 'chore: audit fixes — version updates, company name removal, PVE 9.1'${RESET}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${YELLOW}MANUAL REVIEW STILL NEEDED:${RESET}"
echo "  1. Verify bpg/proxmox provider resource names work with v0.99"
echo "     (proxmox_virtual_machine may now be proxmox_virtual_environment_vm)"
echo "  2. Update ansible/lab-database/tasks/main.yml apt_key → deb822_repository"
echo "  3. Add Python >= 3.12 requirement to prerequisites (required by Ansible 2.20)"
echo "  4. Test terraform validate after provider version bump"
echo ""
