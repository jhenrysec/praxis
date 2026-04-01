#!/usr/bin/env python3
"""IEC 61850 / MMS protocol validation.

Tests TCP connectivity on port 102 (ISO-TSAP / MMS) and attempts a basic
COTP connection request. IEC 61850 is used in electric utility SCADA scenarios
for GOOSE messaging and MMS report manipulation.

Usage:
    python3 validate-iec61850.py [--host 192.168.100.50] [--port 102]
"""

import argparse
import socket
import struct
import sys
from typing import NamedTuple


class TestResult(NamedTuple):
    name: str
    passed: bool
    detail: str


def build_cotp_cr() -> bytes:
    """Build a COTP Connection Request (CR TPDU) over TPKT.

    TPKT header (4 bytes):
      version: 3
      reserved: 0
      length: total packet length (2 bytes BE)

    COTP CR TPDU:
      length: PDU length
      type: 0xE0 (CR)
      dst_ref: 0x0000
      src_ref: 0x0001
      class: 0x00
    """
    # COTP CR payload
    cotp = struct.pack(">B B HH B",
                       6,       # COTP length indicator
                       0xE0,    # CR type
                       0x0000,  # Destination reference
                       0x0001,  # Source reference
                       0x00)    # Class 0

    # TPKT header
    total_len = 4 + len(cotp)
    tpkt = struct.pack(">BBH", 3, 0, total_len)

    return tpkt + cotp


def validate_iec61850(host: str, port: int = 102) -> list[TestResult]:
    """Validate IEC 61850/MMS endpoint via COTP."""
    results: list[TestResult] = []

    # Test 1: TCP connectivity on port 102
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    try:
        sock.connect((host, port))
        results.append(TestResult(
            "IEC 61850 TCP Connect",
            True,
            f"Connected to {host}:{port} (ISO-TSAP/MMS)"
        ))
    except (ConnectionRefusedError, socket.timeout, OSError) as e:
        results.append(TestResult("IEC 61850 TCP Connect", False, str(e)))
        return results

    # Test 2: Send COTP Connection Request
    try:
        cr = build_cotp_cr()
        sock.send(cr)

        response = sock.recv(1024)
        if len(response) >= 7:
            # Parse TPKT header
            tpkt_ver, _, tpkt_len = struct.unpack_from(">BBH", response, 0)
            # Parse COTP
            cotp_len = response[4]
            cotp_type = response[5]

            if cotp_type == 0xD0:  # CC = Connection Confirm
                results.append(TestResult(
                    "COTP Connection Confirm",
                    True,
                    f"Received CC TPDU (0xD0) — COTP session established"
                ))
            elif cotp_type == 0xE0:  # CR echo (some implementations)
                results.append(TestResult(
                    "COTP Connection Confirm",
                    True,
                    f"Received CR echo — endpoint is IEC 61850 aware"
                ))
            else:
                results.append(TestResult(
                    "COTP Connection Confirm",
                    False,
                    f"Unexpected COTP type: 0x{cotp_type:02x} (expected 0xD0 CC)"
                ))
        elif len(response) > 0:
            results.append(TestResult(
                "COTP Connection Confirm",
                True,
                f"Received {len(response)} bytes — endpoint responded"
            ))
        else:
            results.append(TestResult(
                "COTP Connection Confirm",
                False,
                "No response to COTP CR"
            ))
    except socket.timeout:
        results.append(TestResult(
            "COTP Connection Confirm",
            False,
            "Timeout waiting for COTP CC response"
        ))
    except Exception as e:
        results.append(TestResult("COTP Connection Confirm", False, str(e)))

    sock.close()
    return results


def print_results(results: list[TestResult]) -> int:
    """Print test results and return failure count."""
    print(f"\n{'='*60}")
    print("  IEC 61850 / MMS — Endpoint Validation")
    print(f"{'='*60}")
    failures = 0
    for r in results:
        status = "\033[32mPASS\033[0m" if r.passed else "\033[31mFAIL\033[0m"
        if not r.passed:
            failures += 1
        print(f"  [{status}] {r.name}")
        print(f"         {r.detail}")
    passed = len(results) - failures
    print(f"\n  Result: {passed}/{len(results)} passed")
    return failures


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate IEC 61850/MMS endpoint")
    parser.add_argument("--host", default="192.168.100.50", help="IEC 61850 device IP")
    parser.add_argument("--port", type=int, default=102, help="MMS/COTP port")
    args = parser.parse_args()

    results = validate_iec61850(args.host, args.port)
    failures = print_results(results)

    print(f"\n{'='*60}")
    if failures == 0:
        print("  \033[32mAll IEC 61850 validations passed.\033[0m")
    else:
        print(f"  \033[31m{failures} test(s) failed.\033[0m")
    print(f"{'='*60}\n")

    sys.exit(1 if failures > 0 else 0)


if __name__ == "__main__":
    main()
