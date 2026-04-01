#!/usr/bin/env python3
"""EtherNet/IP (CIP) protocol validation.

Tests TCP connectivity on port 44818 and attempts CIP ListIdentity
to discover EtherNet/IP devices. Used for scenarios with Rockwell/Allen-Bradley
style PLC simulation.

Usage:
    python3 validate-ethernetip.py [--host 192.168.100.12] [--port 44818]
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


def build_list_identity_request() -> bytes:
    """Build a CIP ListIdentity encapsulation header (EtherNet/IP).

    Encapsulation header (24 bytes):
      command:         0x0063 (ListIdentity)
      length:          0x0000 (no data)
      session_handle:  0x00000000
      status:          0x00000000
      sender_context:  8 bytes of 0x00
      options:         0x00000000
    """
    return struct.pack("<HH I I 8s I",
                       0x0063,      # Command: ListIdentity
                       0x0000,      # Data length
                       0x00000000,  # Session handle
                       0x00000000,  # Status
                       b'\x00' * 8, # Sender context
                       0x00000000)  # Options


def validate_ethernetip(host: str, port: int = 44818) -> list[TestResult]:
    """Validate EtherNet/IP endpoint."""
    results: list[TestResult] = []

    # Test 1: TCP connectivity
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    try:
        sock.connect((host, port))
        results.append(TestResult(
            "EtherNet/IP TCP Connect",
            True,
            f"Connected to {host}:{port}"
        ))
    except (ConnectionRefusedError, socket.timeout, OSError) as e:
        results.append(TestResult("EtherNet/IP TCP Connect", False, str(e)))
        return results

    # Test 2: ListIdentity request
    try:
        request = build_list_identity_request()
        sock.send(request)

        response = sock.recv(1024)
        if len(response) >= 24:
            cmd, length, session, status = struct.unpack_from("<HH I I", response, 0)
            results.append(TestResult(
                "CIP ListIdentity Response",
                cmd == 0x0063,
                f"Response: cmd=0x{cmd:04x}, len={length}, status=0x{status:08x}"
            ))

            # Parse identity if we got data
            if length > 0 and len(response) > 24:
                results.append(TestResult(
                    "CIP Identity Data",
                    True,
                    f"Received {length} bytes of identity data"
                ))
        elif len(response) > 0:
            results.append(TestResult(
                "CIP ListIdentity Response",
                True,
                f"Received {len(response)} bytes (non-standard response format)"
            ))
        else:
            results.append(TestResult(
                "CIP ListIdentity Response",
                False,
                "No response to ListIdentity request"
            ))
    except socket.timeout:
        results.append(TestResult(
            "CIP ListIdentity Response",
            False,
            "Timeout waiting for ListIdentity response"
        ))
    except Exception as e:
        results.append(TestResult("CIP ListIdentity Response", False, str(e)))

    sock.close()
    return results


def print_results(results: list[TestResult]) -> int:
    """Print test results and return failure count."""
    print(f"\n{'='*60}")
    print("  EtherNet/IP (CIP) — Endpoint Validation")
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
    parser = argparse.ArgumentParser(description="Validate EtherNet/IP endpoint")
    parser.add_argument("--host", default="192.168.100.12", help="EtherNet/IP device IP")
    parser.add_argument("--port", type=int, default=44818, help="EtherNet/IP port")
    args = parser.parse_args()

    results = validate_ethernetip(args.host, args.port)
    failures = print_results(results)

    print(f"\n{'='*60}")
    if failures == 0:
        print("  \033[32mAll EtherNet/IP validations passed.\033[0m")
    else:
        print(f"  \033[31m{failures} test(s) failed.\033[0m")
    print(f"{'='*60}\n")

    sys.exit(1 if failures > 0 else 0)


if __name__ == "__main__":
    main()
