#!/usr/bin/env bash
set -euo pipefail

# SCADA Protocol Validation — Run all protocol tests
# Usage: ./scripts/scada-validation/validate-all.sh [--openplc-ip IP] [--ignition-ip IP]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults (OT zone IPs)
OPENPLC_IP="${OPENPLC_IP:-192.168.100.10}"
GRFICS_IP="${GRFICS_IP:-192.168.100.30}"
IGNITION_IP="${IGNITION_IP:-192.168.100.20}"
DNP3_IP="${DNP3_IP:-192.168.100.40}"
ETHERNETIP_IP="${ETHERNETIP_IP:-192.168.100.12}"
IEC61850_IP="${IEC61850_IP:-192.168.100.50}"

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --openplc-ip)  OPENPLC_IP="$2"; shift 2 ;;
        --grfics-ip)   GRFICS_IP="$2"; shift 2 ;;
        --ignition-ip) IGNITION_IP="$2"; shift 2 ;;
        --dnp3-ip)     DNP3_IP="$2"; shift 2 ;;
        --ethernetip-ip) ETHERNETIP_IP="$2"; shift 2 ;;
        --iec61850-ip) IEC61850_IP="$2"; shift 2 ;;
        --help)
            echo "Usage: $0 [--openplc-ip IP] [--grfics-ip IP] [--ignition-ip IP]"
            echo "          [--dnp3-ip IP] [--ethernetip-ip IP] [--iec61850-ip IP]"
            echo ""
            echo "Environment variables: OPENPLC_IP, GRFICS_IP, IGNITION_IP, DNP3_IP,"
            echo "                       ETHERNETIP_IP, IEC61850_IP"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          SCADA Protocol Validation Suite                ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Modbus TCP  : ${OPENPLC_IP}:502, ${GRFICS_IP}:502     "
echo "║  OPC-UA      : ${IGNITION_IP}:4840                     "
echo "║  DNP3        : ${DNP3_IP}:20000                         "
echo "║  EtherNet/IP : ${ETHERNETIP_IP}:44818                   "
echo "║  IEC 61850   : ${IEC61850_IP}:102                       "
echo "╚══════════════════════════════════════════════════════════╝"

FAILURES=0

# Modbus TCP (OpenPLC + GRFICSv2)
echo ""
echo ">>> Modbus TCP validation..."
python3 "${SCRIPT_DIR}/validate-modbus.py" \
    --plc-ip "${OPENPLC_IP}" \
    --grfics-ip "${GRFICS_IP}" || FAILURES=$((FAILURES + 1))

# OPC-UA (Ignition)
echo ""
echo ">>> OPC-UA validation..."
python3 "${SCRIPT_DIR}/validate-opcua.py" \
    --host "${IGNITION_IP}" || FAILURES=$((FAILURES + 1))

# DNP3
echo ""
echo ">>> DNP3 validation..."
python3 "${SCRIPT_DIR}/validate-dnp3.py" \
    --host "${DNP3_IP}" || FAILURES=$((FAILURES + 1))

# EtherNet/IP
echo ""
echo ">>> EtherNet/IP validation..."
python3 "${SCRIPT_DIR}/validate-ethernetip.py" \
    --host "${ETHERNETIP_IP}" || FAILURES=$((FAILURES + 1))

# IEC 61850
echo ""
echo ">>> IEC 61850/MMS validation..."
python3 "${SCRIPT_DIR}/validate-iec61850.py" \
    --host "${IEC61850_IP}" || FAILURES=$((FAILURES + 1))

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
if [[ "${FAILURES}" -eq 0 ]]; then
    echo "║  ✅ All protocol validations passed                     ║"
else
    echo "║  ❌ ${FAILURES} protocol suite(s) had failures                   ║"
fi
echo "╚══════════════════════════════════════════════════════════╝"

exit "${FAILURES}"
