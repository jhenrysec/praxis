#!/usr/bin/env bash
# scripts/check-isos.sh
# Checks Proxmox storage for required ISOs and downloads missing ones.
# Usage: ./scripts/check-isos.sh [--download] [--template <template_name>]
#
# Options:
#   --download       Automatically download ISOs marked auto_download: true
#   --template NAME  Check ISOs for a specific template only
#   --upload         Upload downloaded ISOs to Proxmox storage via API
#   --list           List all required ISOs without checking
#
# Requires: yq (YAML parser), curl, ssh access to Proxmox host
# Install yq: pip3 install yq  OR  snap install yq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${REPO_ROOT}/scripts/iso-manifest.yaml"
ISO_CACHE="${REPO_ROOT}/.iso-cache"

# Colors
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

PASS=0; FAIL=0; WARN=0; DOWNLOADED=0
DO_DOWNLOAD=false
DO_UPLOAD=false
DO_LIST=false
FILTER_TEMPLATE=""

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --download) DO_DOWNLOAD=true; shift ;;
    --upload)   DO_UPLOAD=true; shift ;;
    --list)     DO_LIST=true; shift ;;
    --template) FILTER_TEMPLATE="$2"; shift 2 ;;
    *)          echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Prereqs ──────────────────────────────────────────────────────────────────
if ! command -v yq &>/dev/null; then
  echo -e "${RED}❌ yq not found. Install: pip3 install yq${RESET}"
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo -e "${RED}❌ ISO manifest not found: ${MANIFEST}${RESET}"
  exit 1
fi

mkdir -p "$ISO_CACHE"

# ── Load credentials ─────────────────────────────────────────────────────────
if [[ -f "${REPO_ROOT}/scripts/lab-env.local.sh" ]]; then
  source "${REPO_ROOT}/scripts/lab-env.local.sh" 2>/dev/null || true
fi

PROXMOX_HOST="${PROXMOX_HOST:-192.168.1.50}"

# ── Get ISOs currently on Proxmox ────────────────────────────────────────────
get_proxmox_isos() {
  if [[ -n "${PROXMOX_VE_API_TOKEN_ID:-}" && -n "${PROXMOX_VE_API_TOKEN_SECRET:-}" ]]; then
    # Use API
    curl -s -k \
      -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}" \
      "${PROXMOX_VE_ENDPOINT:-https://${PROXMOX_HOST}:8006/}api2/json/nodes/pve01/storage/local/content" \
      2>/dev/null | jq -r '.data[]? | select(.content == "iso") | .volid' 2>/dev/null || echo ""
  elif ssh -q -o ConnectTimeout=5 "root@${PROXMOX_HOST}" true 2>/dev/null; then
    # Use SSH
    ssh "root@${PROXMOX_HOST}" "pvesm list local --content iso" 2>/dev/null | awk 'NR>1 {print $1}' || echo ""
  else
    echo ""
  fi
}

# ── Header ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║              ISO Availability Check              ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# ── List mode ────────────────────────────────────────────────────────────────
if $DO_LIST; then
  echo -e "${BOLD}Required ISOs:${RESET}"
  echo ""
  yq -r '.isos[] | "  \(.id): \(.filename) (\(.size_gb) GB) — \(.notes)"' "$MANIFEST"
  echo ""
  exit 0
fi

# ── Check Proxmox connectivity ───────────────────────────────────────────────
echo -e "${BOLD}── Checking Proxmox ISO storage ──${RESET}"
PROXMOX_ISOS=$(get_proxmox_isos)

if [[ -z "$PROXMOX_ISOS" ]]; then
  echo -e "${YELLOW}⚠️  Cannot query Proxmox storage — checking local cache only${RESET}"
  echo -e "   Set credentials in scripts/lab-env.local.sh or ensure SSH access to ${PROXMOX_HOST}"
  echo ""
  USE_PROXMOX=false
else
  echo -e "${GREEN}✅ Connected to Proxmox storage${RESET}"
  echo ""
  USE_PROXMOX=true
fi

# ── Check each ISO ───────────────────────────────────────────────────────────
ISO_COUNT=$(yq -r '.isos | length' "$MANIFEST")

for i in $(seq 0 $((ISO_COUNT - 1))); do
  ISO_ID=$(yq -r ".isos[$i].id" "$MANIFEST")
  ISO_FILE=$(yq -r ".isos[$i].filename" "$MANIFEST")
  ISO_TEMPLATE=$(yq -r ".isos[$i].template" "$MANIFEST")
  ISO_URL=$(yq -r ".isos[$i].url" "$MANIFEST")
  ISO_SIZE=$(yq -r ".isos[$i].size_gb" "$MANIFEST")
  ISO_AUTO=$(yq -r ".isos[$i].auto_download" "$MANIFEST")
  ISO_NOTES=$(yq -r ".isos[$i].notes" "$MANIFEST")
  ISO_STORAGE=$(yq -r ".isos[$i].storage" "$MANIFEST")

  # Filter by template if specified
  if [[ -n "$FILTER_TEMPLATE" && "$ISO_TEMPLATE" != "$FILTER_TEMPLATE" ]]; then
    continue
  fi

  # Check on Proxmox
  FOUND_ON_PROXMOX=false
  if $USE_PROXMOX; then
    if echo "$PROXMOX_ISOS" | grep -q "$ISO_FILE"; then
      FOUND_ON_PROXMOX=true
    fi
  fi

  # Check in local cache
  FOUND_IN_CACHE=false
  if [[ -f "${ISO_CACHE}/${ISO_FILE}" ]]; then
    FOUND_IN_CACHE=true
  fi

  if $FOUND_ON_PROXMOX; then
    echo -e "  ${GREEN}✅ ${ISO_ID}${RESET}: ${ISO_FILE} — on Proxmox"
    ((PASS++))
  elif $FOUND_IN_CACHE; then
    echo -e "  ${YELLOW}⚠️  ${ISO_ID}${RESET}: ${ISO_FILE} — in local cache (not on Proxmox)"
    echo -e "     Upload with: ssh root@${PROXMOX_HOST} 'pvesm upload ${ISO_STORAGE} /tmp/${ISO_FILE}'"
    ((WARN++))
  else
    echo -e "  ${RED}❌ ${ISO_ID}${RESET}: ${ISO_FILE} — MISSING"

    if [[ "$ISO_AUTO" == "true" && -n "$ISO_URL" ]]; then
      if $DO_DOWNLOAD; then
        echo -e "     ${CYAN}→ Downloading ${ISO_SIZE} GB...${RESET}"
        if curl -L -# -o "${ISO_CACHE}/${ISO_FILE}" "$ISO_URL"; then
          echo -e "     ${GREEN}✅ Downloaded to ${ISO_CACHE}/${ISO_FILE}${RESET}"
          ((DOWNLOADED++))

          if $DO_UPLOAD && $USE_PROXMOX; then
            echo -e "     ${CYAN}→ Uploading to Proxmox...${RESET}"
            scp "${ISO_CACHE}/${ISO_FILE}" "root@${PROXMOX_HOST}:/tmp/${ISO_FILE}"
            ssh "root@${PROXMOX_HOST}" "pvesm upload ${ISO_STORAGE} /tmp/${ISO_FILE} && rm /tmp/${ISO_FILE}"
            echo -e "     ${GREEN}✅ Uploaded to Proxmox ${ISO_STORAGE}${RESET}"
          fi
        else
          echo -e "     ${RED}❌ Download failed${RESET}"
          ((FAIL++))
          continue
        fi
      else
        echo -e "     Run with --download to fetch automatically"
      fi
    else
      echo -e "     ${YELLOW}Manual download required:${RESET}"
      echo -e "     ${ISO_NOTES}"
    fi
    ((FAIL++))
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Summary ──${RESET}"
echo -e "  ${GREEN}✅ Available: ${PASS}${RESET}"
[[ $WARN -gt 0 ]] && echo -e "  ${YELLOW}⚠️  Cached (need upload): ${WARN}${RESET}"
[[ $FAIL -gt 0 ]] && echo -e "  ${RED}❌ Missing: ${FAIL}${RESET}"
[[ $DOWNLOADED -gt 0 ]] && echo -e "  ${CYAN}📥 Downloaded this run: ${DOWNLOADED}${RESET}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}${BOLD}Some ISOs are missing. Packer builds will fail without them.${RESET}"
  echo -e "Run: ${BOLD}./scripts/check-isos.sh --download --upload${RESET} to fetch and upload auto-downloadable ISOs."
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}All required ISOs are available.${RESET}"
  echo ""
fi
