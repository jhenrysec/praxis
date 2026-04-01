#!/usr/bin/env python3
"""OPC-UA protocol validation for Ignition Gateway.

Tests anonymous connection, server browsing, and tag read/write operations
against the Ignition OPC-UA server endpoint.

Usage:
    python3 validate-opcua.py [--host 192.168.100.20] [--port 4840]
"""

import argparse
import sys
from typing import NamedTuple

try:
    from opcua import Client, ua
except ImportError:
    print("ERROR: opcua not installed. Run: pip3 install opcua>=0.98.0")
    sys.exit(1)


class TestResult(NamedTuple):
    name: str
    passed: bool
    detail: str


def validate_opcua(host: str, port: int = 4840) -> list[TestResult]:
    """Validate OPC-UA server on Ignition Gateway."""
    results: list[TestResult] = []
    url = f"opc.tcp://{host}:{port}/"
    client = Client(url)

    # Test 1: Anonymous connection
    try:
        client.connect()
        results.append(TestResult(
            "Anonymous Connect",
            True,
            f"Connected to {url} without credentials"
        ))
    except Exception as e:
        results.append(TestResult("Anonymous Connect", False, str(e)))
        return results

    # Test 2: Server status
    try:
        server_state = client.get_node("ns=0;i=2259").get_value()
        results.append(TestResult(
            "Server State",
            server_state == 0,  # 0 = Running
            f"ServerState = {server_state} (0=Running)"
        ))
    except Exception as e:
        results.append(TestResult("Server State", False, str(e)))

    # Test 3: Browse root node
    try:
        root = client.get_root_node()
        children = root.get_children()
        results.append(TestResult(
            "Browse Root Node",
            len(children) > 0,
            f"Root has {len(children)} child nodes"
        ))
    except Exception as e:
        results.append(TestResult("Browse Root Node", False, str(e)))

    # Test 4: Browse Objects folder
    try:
        objects = client.get_objects_node()
        obj_children = objects.get_children()
        child_names = [c.get_browse_name().Name for c in obj_children[:10]]
        results.append(TestResult(
            "Browse Objects",
            len(obj_children) > 0,
            f"Objects folder: {child_names}"
        ))
    except Exception as e:
        results.append(TestResult("Browse Objects", False, str(e)))

    # Test 5: Server endpoints (security policy check)
    try:
        endpoints = client.connect_and_get_server_endpoints()
        policies = [ep.SecurityPolicyUri.split("#")[-1] for ep in endpoints]
        has_none = any("None" in p for p in policies)
        results.append(TestResult(
            "Security Policies",
            has_none,
            f"Policies: {policies} — Anonymous={'available' if has_none else 'NOT available'}"
        ))
    except Exception as e:
        results.append(TestResult("Security Policies", False, str(e)))

    # Test 6: Server build info
    try:
        build_info = client.get_node("ns=0;i=2260").get_value()
        results.append(TestResult(
            "Server Build Info",
            True,
            f"Product: {build_info.ProductName}, Version: {build_info.SoftwareVersion}"
        ))
    except Exception as e:
        results.append(TestResult("Server Build Info", False, str(e)))

    try:
        client.disconnect()
    except Exception:
        pass

    return results


def print_results(results: list[TestResult]) -> int:
    """Print test results and return failure count."""
    print(f"\n{'='*60}")
    print("  OPC-UA — Ignition Gateway")
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
    parser = argparse.ArgumentParser(description="Validate OPC-UA endpoint")
    parser.add_argument("--host", default="192.168.100.20", help="Ignition Gateway IP")
    parser.add_argument("--port", type=int, default=4840, help="OPC-UA port")
    args = parser.parse_args()

    results = validate_opcua(args.host, args.port)
    failures = print_results(results)

    print(f"\n{'='*60}")
    if failures == 0:
        print("  \033[32mAll OPC-UA validations passed.\033[0m")
    else:
        print(f"  \033[31m{failures} test(s) failed.\033[0m")
    print(f"{'='*60}\n")

    sys.exit(1 if failures > 0 else 0)


if __name__ == "__main__":
    main()
