#!/usr/bin/env bash
# scripts/iso-manage.sh
# Dynamic ISO resolver and manager for the vulnerability lab.
# Resolves distro+version to download URLs, checks Proxmox storage,
# and downloads/uploads missing ISOs automatically when possible.
#
# Usage:
#   ./scripts/iso-manage.sh list                          # Show ISOs on Proxmox
#   ./scripts/iso-manage.sh resolve <distro> [version]    # Look up download info
#   ./scripts/iso-manage.sh ensure <distro> [version]     # Download + upload if missing
#   ./scripts/iso-manage.sh ensure-list <file>            # Ensure all ISOs in a file
#   ./scripts/iso-manage.sh search <term>                 # Search known distros
#
# The script uses iso-sources.yaml as a knowledge base of URL patterns.
# When a scenario needs an ISO not in the sources file, add an entry
# or use the manual download instructions.
#
# Requires: yq, curl, jq
# Install yq: pip3 install yq --break-system-packages

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCES="${REPO_ROOT}/scripts/iso-sources.yaml"
ISO_CACHE="${REPO_ROOT}/.iso-cache"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

# ── Prereqs ──────────────────────────────────────────────────────────────────
check_deps() {
  local missing=false
  for cmd in yq curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      echo -e "${RED}❌ Required: $cmd${RESET}"
      missing=true
    fi
  done
  $missing && exit 1
}

# ── Load credentials ─────────────────────────────────────────────────────────
load_env() {
  if [[ -f "${REPO_ROOT}/scripts/lab-env.local.sh" ]]; then
    source "${REPO_ROOT}/scripts/lab-env.local.sh" 2>/dev/null || true
  elif [[ -f "${REPO_ROOT}/scripts/lab-env.sh" ]]; then
    source "${REPO_ROOT}/scripts/lab-env.sh" 2>/dev/null || true
  fi
  PROXMOX_HOST="${PROXMOX_HOST:-192.168.1.50}"
}

# ── Proxmox queries ──────────────────────────────────────────────────────────
get_proxmox_isos() {
  if [[ -n "${PROXMOX_VE_API_TOKEN_ID:-}" && -n "${PROXMOX_VE_API_TOKEN_SECRET:-}" ]]; then
    local endpoint="${PROXMOX_VE_ENDPOINT:-https://${PROXMOX_HOST}:8006/}"
    curl -s -k \
      -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN_ID}=${PROXMOX_VE_API_TOKEN_SECRET}" \
      "${endpoint}api2/json/nodes/pve01/storage/local/content" \
      2>/dev/null | jq -r '.data[]? | select(.content == "iso") | .volid' 2>/dev/null || echo ""
  elif ssh -q -o ConnectTimeout=5 -o BatchMode=yes "root@${PROXMOX_HOST}" true 2>/dev/null; then
    ssh "root@${PROXMOX_HOST}" "pvesm list local --content iso" 2>/dev/null | awk 'NR>1 {print $1}' || echo ""
  else
    echo ""
  fi
}

iso_on_proxmox() {
  local filename="$1"
  local isos
  isos=$(get_proxmox_isos)
  echo "$isos" | grep -q "$filename" 2>/dev/null
}

# ── Version parsing ──────────────────────────────────────────────────────────
parse_version() {
  local version="$1"
  FULL_VERSION="$version"
  MAJOR=$(echo "$version" | cut -d. -f1)
  MINOR=$(echo "$version" | cut -d. -f2 2>/dev/null || echo "")
  PATCH=$(echo "$version" | cut -d. -f3 2>/dev/null || echo "")
}

# ── URL pattern expansion ────────────────────────────────────────────────────
expand_pattern() {
  local pattern="$1"
  local version="$2"
  parse_version "$version"
  echo "$pattern" \
    | sed "s|{version}|${FULL_VERSION}|g" \
    | sed "s|{major}|${MAJOR}|g" \
    | sed "s|{minor}|${MINOR}|g" \
    | sed "s|{patch}|${PATCH}|g" \
    | sed "s|{arch}|amd64|g"
}

# ── Source lookup ────────────────────────────────────────────────────────────
lookup_source() {
  local distro="$1"
  if ! yq -r ".sources.\"${distro}\"" "$SOURCES" 2>/dev/null | grep -q "display_name"; then
    return 1
  fi
  return 0
}

get_field() {
  local distro="$1" field="$2"
  yq -r ".sources.\"${distro}\".${field} // \"\"" "$SOURCES" 2>/dev/null
}

# ── Resolve a distro+version to download URL and filename ────────────────────
resolve() {
  local distro="$1"
  local version="${2:-}"

  if ! lookup_source "$distro"; then
    echo -e "${RED}❌ Unknown distro: ${distro}${RESET}"
    echo -e "   Run ${BOLD}./scripts/iso-manage.sh search ${distro}${RESET} to find matches"
    echo -e "   Or add an entry to ${BOLD}scripts/iso-sources.yaml${RESET}"
    return 1
  fi

  local display auto url_pattern filename_pattern notes checksum_url post_download
  display=$(get_field "$distro" "display_name")
  auto=$(get_field "$distro" "auto_download")
  url_pattern=$(get_field "$distro" "url_pattern")
  filename_pattern=$(get_field "$distro" "filename_pattern")
  notes=$(get_field "$distro" "notes")
  checksum_url=$(get_field "$distro" "checksum_url")
  post_download=$(get_field "$distro" "post_download")

  # For ISOs that don't need a version (like virtio-win)
  if [[ -z "$version" && "$url_pattern" != *"{version}"* && -n "$url_pattern" ]]; then
    RESOLVED_URL="$url_pattern"
    RESOLVED_FILENAME="$filename_pattern"
    RESOLVED_AUTO="$auto"
    RESOLVED_DISPLAY="$display"
    RESOLVED_NOTES="$notes"
    RESOLVED_POST="$post_download"
    RESOLVED_CHECKSUM=$(expand_pattern "${checksum_url}" "${version:-latest}" 2>/dev/null || echo "")
    return 0
  fi

  if [[ -z "$version" ]]; then
    echo -e "${YELLOW}⚠️  ${display} requires a version number${RESET}"
    echo -e "   Example: ${BOLD}./scripts/iso-manage.sh ensure ${distro} 24.04.4${RESET}"
    echo -e "   ${DIM}${notes}${RESET}"
    return 1
  fi

  if [[ "$auto" == "true" && -n "$url_pattern" ]]; then
    RESOLVED_URL=$(expand_pattern "$url_pattern" "$version")
    RESOLVED_FILENAME=$(expand_pattern "$filename_pattern" "$version")
    RESOLVED_CHECKSUM=$(expand_pattern "${checksum_url}" "$version" 2>/dev/null || echo "")
  else
    RESOLVED_URL=""
    RESOLVED_FILENAME=$(expand_pattern "$filename_pattern" "$version")
  fi

  RESOLVED_AUTO="$auto"
  RESOLVED_DISPLAY="$display"
  RESOLVED_NOTES="$notes"
  RESOLVED_POST="$post_download"
  return 0
}

# ── Ensure an ISO exists on Proxmox ──────────────────────────────────────────
ensure_iso() {
  local distro="$1"
  local version="${2:-}"

  if ! resolve "$distro" "$version"; then
    return 1
  fi

  echo -e "  ${BOLD}${RESOLVED_DISPLAY}${RESET}${version:+ ${version}}"
  echo -e "  Filename: ${RESOLVED_FILENAME}"

  # Check Proxmox first
  if iso_on_proxmox "$RESOLVED_FILENAME"; then
    echo -e "  ${GREEN}✅ Already on Proxmox${RESET}"
    echo ""
    return 0
  fi

  # Check local cache
  if [[ -f "${ISO_CACHE}/${RESOLVED_FILENAME}" ]]; then
    echo -e "  ${YELLOW}⚠️  In local cache — uploading to Proxmox...${RESET}"
    upload_iso "${ISO_CACHE}/${RESOLVED_FILENAME}" "$RESOLVED_FILENAME"
    echo ""
    return $?
  fi

  # Need to download
  if [[ "$RESOLVED_AUTO" != "true" || -z "$RESOLVED_URL" ]]; then
    echo -e "  ${RED}❌ Not on Proxmox — manual download required${RESET}"
    echo -e "  ${DIM}${RESOLVED_NOTES}${RESET}"
    echo -e "  After downloading, upload with:"
    echo -e "    ${BOLD}scp <file> root@${PROXMOX_HOST}:/tmp/${RESET}"
    echo -e "    ${BOLD}ssh root@${PROXMOX_HOST} 'pvesm upload local /tmp/<file> && rm /tmp/<file>'${RESET}"
    echo ""
    return 1
  fi

  # Verify URL is reachable before downloading
  echo -e "  ${CYAN}→ Checking URL...${RESET}"
  local http_code
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" -L "$RESOLVED_URL" 2>/dev/null || echo "000")

  if [[ "$http_code" != "200" && "$http_code" != "302" && "$http_code" != "301" ]]; then
    echo -e "  ${RED}❌ URL returned HTTP ${http_code} — may be wrong version${RESET}"
    echo -e "  Tried: ${RESOLVED_URL}"
    echo -e "  ${DIM}Check if this version exists, or update iso-sources.yaml${RESET}"
    echo ""
    return 1
  fi

  # Download
  mkdir -p "$ISO_CACHE"
  echo -e "  ${CYAN}→ Downloading...${RESET}"
  echo -e "  ${DIM}${RESOLVED_URL}${RESET}"
  if ! curl -L -# -o "${ISO_CACHE}/${RESOLVED_FILENAME}" "$RESOLVED_URL"; then
    echo -e "  ${RED}❌ Download failed${RESET}"
    rm -f "${ISO_CACHE}/${RESOLVED_FILENAME}"
    echo ""
    return 1
  fi

  # Post-download processing (decompress if needed)
  if [[ -n "$RESOLVED_POST" && "$RESOLVED_POST" != "null" ]]; then
    echo -e "  ${CYAN}→ Post-processing: ${RESOLVED_POST}${RESET}"
    case "$RESOLVED_POST" in
      bunzip2)
        bunzip2 "${ISO_CACHE}/${RESOLVED_FILENAME}"
        RESOLVED_FILENAME="${RESOLVED_FILENAME%.bz2}"
        ;;
      gunzip)
        gunzip "${ISO_CACHE}/${RESOLVED_FILENAME}"
        RESOLVED_FILENAME="${RESOLVED_FILENAME%.gz}"
        ;;
    esac
  fi

  echo -e "  ${GREEN}✅ Downloaded to ${ISO_CACHE}/${RESOLVED_FILENAME}${RESET}"

  # Upload to Proxmox
  upload_iso "${ISO_CACHE}/${RESOLVED_FILENAME}" "$RESOLVED_FILENAME"
  echo ""
  return $?
}

upload_iso() {
  local filepath="$1"
  local filename="$2"

  if [[ -z "${PROXMOX_VE_API_TOKEN_ID:-}" && -z "${PROXMOX_VE_API_TOKEN_SECRET:-}" ]]; then
    # Try SSH
    if ssh -q -o ConnectTimeout=5 -o BatchMode=yes "root@${PROXMOX_HOST}" true 2>/dev/null; then
      echo -e "  ${CYAN}→ Uploading via SCP...${RESET}"
      if scp "$filepath" "root@${PROXMOX_HOST}:/tmp/${filename}"; then
        ssh "root@${PROXMOX_HOST}" "pvesm upload local /tmp/${filename} && rm /tmp/${filename}"
        echo -e "  ${GREEN}✅ Uploaded to Proxmox local storage${RESET}"
        return 0
      fi
    fi
    echo -e "  ${YELLOW}⚠️  Cannot upload — no Proxmox credentials or SSH access${RESET}"
    echo -e "  ISO saved at: ${filepath}"
    echo -e "  Upload manually: scp ${filepath} root@${PROXMOX_HOST}:/tmp/"
    return 1
  fi

  # Use API upload if available
  echo -e "  ${CYAN}→ Uploading via SCP...${RESET}"
  if scp "$filepath" "root@${PROXMOX_HOST}:/tmp/${filename}"; then
    ssh "root@${PROXMOX_HOST}" "pvesm upload local /tmp/${filename} && rm /tmp/${filename}"
    echo -e "  ${GREEN}✅ Uploaded to Proxmox local storage${RESET}"
    return 0
  else
    echo -e "  ${YELLOW}⚠️  SCP upload failed — ISO saved locally at ${filepath}${RESET}"
    return 1
  fi
}

# ── Commands ─────────────────────────────────────────────────────────────────

cmd_list() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║           ISOs on Proxmox Storage                ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
  echo ""

  local isos
  isos=$(get_proxmox_isos)

  if [[ -z "$isos" ]]; then
    echo -e "${YELLOW}⚠️  Cannot connect to Proxmox or no ISOs found${RESET}"
    echo -e "   Check credentials in scripts/lab-env.local.sh"
    return 1
  fi

  echo "$isos" | while read -r line; do
    [[ -n "$line" ]] && echo -e "  ${GREEN}●${RESET} ${line}"
  done

  echo ""

  # Also check local cache
  if [[ -d "$ISO_CACHE" ]]; then
    local cached
    cached=$(find "$ISO_CACHE" -name "*.iso" -o -name "*.img" 2>/dev/null)
    if [[ -n "$cached" ]]; then
      echo -e "${BOLD}Local cache (not yet uploaded):${RESET}"
      echo "$cached" | while read -r f; do
        echo -e "  ${YELLOW}●${RESET} $(basename "$f")"
      done
      echo ""
    fi
  fi
}

cmd_resolve() {
  local distro="$1"
  local version="${2:-}"

  echo ""
  if ! resolve "$distro" "$version"; then
    return 1
  fi

  echo -e "${BOLD}${RESOLVED_DISPLAY}${RESET}${version:+ ${version}}"
  echo -e "  Filename:      ${RESOLVED_FILENAME}"
  echo -e "  Auto-download: ${RESOLVED_AUTO}"
  if [[ -n "$RESOLVED_URL" ]]; then
    echo -e "  URL:           ${RESOLVED_URL}"
  fi
  if [[ -n "$RESOLVED_CHECKSUM" && "$RESOLVED_CHECKSUM" != "null" ]]; then
    echo -e "  Checksum URL:  ${RESOLVED_CHECKSUM}"
  fi
  if [[ -n "$RESOLVED_POST" && "$RESOLVED_POST" != "null" ]]; then
    echo -e "  Post-download: ${RESOLVED_POST}"
  fi
  echo -e "  Notes:         ${RESOLVED_NOTES}"
  echo ""
}

cmd_ensure() {
  local distro="$1"
  local version="${2:-}"

  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║              Ensuring ISO Availability            ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
  echo ""

  ensure_iso "$distro" "$version"
}

cmd_ensure_list() {
  local listfile="$1"

  if [[ ! -f "$listfile" ]]; then
    echo -e "${RED}❌ File not found: ${listfile}${RESET}"
    return 1
  fi

  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║         Ensuring ISOs from Requirements          ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
  echo ""

  local pass=0 fail=0 total=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and blank lines
    [[ "$line" =~ ^#.*$ || -z "${line// }" ]] && continue

    local distro version
    distro=$(echo "$line" | awk '{print $1}')
    version=$(echo "$line" | awk '{print $2}')
    total=$((total + 1))

    if ensure_iso "$distro" "$version"; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1))
    fi
  done < "$listfile"

  echo -e "${BOLD}── Results ──${RESET}"
  echo -e "  Total: ${total}  ${GREEN}✅ ${pass}${RESET}  ${RED}❌ ${fail}${RESET}"
  echo ""

  [[ $fail -gt 0 ]] && return 1
  return 0
}

cmd_search() {
  local term="$1"
  echo ""
  echo -e "${BOLD}Distros matching '${term}':${RESET}"
  echo ""

  local found=false
  while IFS= read -r key; do
    local display notes auto
    display=$(get_field "$key" "display_name")
    notes=$(get_field "$key" "notes")
    auto=$(get_field "$key" "auto_download")

    if [[ "$auto" == "true" ]]; then
      echo -e "  ${GREEN}●${RESET} ${BOLD}${key}${RESET} — ${display} (auto-download)"
    else
      echo -e "  ${YELLOW}●${RESET} ${BOLD}${key}${RESET} — ${display} (manual)"
    fi
    echo -e "    ${DIM}${notes}${RESET}"
    echo ""
    found=true
  done < <(yq -r ".sources | keys[]" "$SOURCES" 2>/dev/null | grep -i "$term")

  if ! $found; then
    echo -e "  ${YELLOW}No matches found.${RESET}"
    echo -e "  Add a new entry to ${BOLD}scripts/iso-sources.yaml${RESET}"
    echo ""
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
check_deps
load_env

case "${1:-help}" in
  list)
    cmd_list
    ;;
  resolve)
    [[ $# -lt 2 ]] && { echo "Usage: $0 resolve <distro> [version]"; exit 1; }
    cmd_resolve "$2" "${3:-}"
    ;;
  ensure)
    [[ $# -lt 2 ]] && { echo "Usage: $0 ensure <distro> [version]"; exit 1; }
    cmd_ensure "$2" "${3:-}"
    ;;
  ensure-list)
    [[ $# -lt 2 ]] && { echo "Usage: $0 ensure-list <file>"; exit 1; }
    cmd_ensure_list "$2"
    ;;
  search)
    [[ $# -lt 2 ]] && { echo "Usage: $0 search <term>"; exit 1; }
    cmd_search "$2"
    ;;
  help|--help|-h)
    echo ""
    echo -e "${BOLD}ISO Manager — Vulnerability Lab${RESET}"
    echo ""
    echo "Commands:"
    echo "  list                         Show ISOs currently on Proxmox"
    echo "  resolve <distro> [version]   Look up download URL for a distro"
    echo "  ensure <distro> [version]    Download + upload if not on Proxmox"
    echo "  ensure-list <file>           Ensure all ISOs in a requirements file"
    echo "  search <term>               Search known distro sources"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 ensure kali 2026.1"
    echo "  $0 ensure ubuntu-server 24.04.4"
    echo "  $0 ensure virtio-win"
    echo "  $0 ensure debian 12.9.0"
    echo "  $0 ensure-list scenarios/volt_typhoon/iso-requirements.txt"
    echo "  $0 search pfsense"
    echo "  $0 resolve rocky 9.3"
    echo ""
    echo "Requirements file format (one per line):"
    echo "  kali 2026.1"
    echo "  ubuntu-server 24.04.4"
    echo "  windows-server-2022"
    echo "  virtio-win"
    echo ""
    echo "Add new distros to: scripts/iso-sources.yaml"
    echo ""
    ;;
  *)
    echo "Unknown command: $1 — run $0 help"
    exit 1
    ;;
esac
