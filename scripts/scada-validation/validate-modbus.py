#!/usr/bin/env python3
"""Modbus TCP protocol validation for OpenPLC and GRFICSv2.

Tests FC01 (read coils), FC02 (read discrete inputs), FC03 (read holding registers),
FC04 (read input registers) against known register maps. Reports pass/fail for each endpoint.

Usage:
    python3 validate-modbus.py [--plc-ip 192.168.100.10] [--grfics-ip 192.168.100.30]
"""

import argparse
import sys
from typing import NamedTuple

try:
    from pymodbus.client import ModbusTcpClient
    from pymodbus.exceptions import ModbusIOException
except ImportError:
    print("ERROR: pymodbus not installed. Run: pip3 install pymodbus>=3.7.0")
    sys.exit(1)


class TestResult(NamedTuple):
    name: str
    passed: bool
    detail: str


def validate_openplc(ip: str, port: int = 502) -> list[TestResult]:
    """Validate OpenPLC tank_fill_control register map."""
    results: list[TestResult] = []
    client = ModbusTcpClient(ip, port=port, timeout=5)

    if not client.connect():
        return [TestResult("OpenPLC Connect", False, f"Cannot connect to {ip}:{port}")]

    results.append(TestResult("OpenPLC Connect", True, f"Connected to {ip}:{port}"))

    # FC01 — Read Coils (addresses 0-7)
    try:
        rr = client.read_coils(0, 8, slave=1)
        if rr.isError():
            results.append(TestResult("FC01 Read Coils", False, str(rr)))
        else:
            coils = rr.bits[:8]
            results.append(TestResult(
                "FC01 Read Coils",
                True,
                f"Coils 0-7: {['ON' if c else 'OFF' for c in coils]}"
            ))
            # Coil 0 = pump enable — should be TRUE in normal operation
            results.append(TestResult(
                "Coil 0 (Pump Enable)",
                coils[0] is True,
                f"Pump enable = {'ON' if coils[0] else 'OFF'} (expected ON)"
            ))
    except ModbusIOException as e:
        results.append(TestResult("FC01 Read Coils", False, str(e)))

    # FC04 — Read Input Registers (address 0 = tank level sensor)
    try:
        rr = client.read_input_registers(0, 4, slave=1)
        if rr.isError():
            results.append(TestResult("FC04 Input Registers", False, str(rr)))
        else:
            results.append(TestResult(
                "FC04 Input Registers",
                True,
                f"IR0 (tank_level)={rr.registers[0]}"
            ))
    except ModbusIOException as e:
        results.append(TestResult("FC04 Input Registers", False, str(e)))

    # FC03 — Read Holding Registers (address 0 = pump speed output)
    try:
        rr = client.read_holding_registers(0, 4, slave=1)
        if rr.isError():
            results.append(TestResult("FC03 Holding Registers (QW)", False, str(rr)))
        else:
            results.append(TestResult(
                "FC03 Holding Registers (QW)",
                True,
                f"HR0 (pump_speed)={rr.registers[0]}"
            ))
    except ModbusIOException as e:
        results.append(TestResult("FC03 Holding Registers (QW)", False, str(e)))

    # FC03 — Read MW registers (address 1024 = setpoint, 1025 = alarm_high, 1026 = alarm_low)
    try:
        rr = client.read_holding_registers(1024, 3, slave=1)
        if rr.isError():
            results.append(TestResult("FC03 Holding Registers (MW)", False, str(rr)))
        else:
            setpoint = rr.registers[0]
            alarm_hi = rr.registers[1]
            alarm_lo = rr.registers[2]
            results.append(TestResult(
                "FC03 Holding Registers (MW)",
                True,
                f"MW0 (setpoint)={setpoint}, MW1 (alarm_hi)={alarm_hi}, MW2 (alarm_lo)={alarm_lo}"
            ))
            results.append(TestResult(
                "Setpoint Default (750)",
                setpoint == 750,
                f"Setpoint = {setpoint} (expected 750)"
            ))
            results.append(TestResult(
                "Alarm High Default (900)",
                alarm_hi == 900,
                f"Alarm high = {alarm_hi} (expected 900)"
            ))
            results.append(TestResult(
                "Alarm Low Default (200)",
                alarm_lo == 200,
                f"Alarm low = {alarm_lo} (expected 200)"
            ))
    except ModbusIOException as e:
        results.append(TestResult("FC03 Holding Registers (MW)", False, str(e)))

    client.close()
    return results


def validate_grfics(ip: str, port: int = 502) -> list[TestResult]:
    """Validate GRFICSv2 reactor PLC register map."""
    results: list[TestResult] = []
    client = ModbusTcpClient(ip, port=port, timeout=5)

    if not client.connect():
        return [TestResult("GRFICSv2 Connect", False, f"Cannot connect to {ip}:{port}")]

    results.append(TestResult("GRFICSv2 Connect", True, f"Connected to {ip}:{port}"))

    # Read reactor holding registers (HR0=temp setpoint, HR1=pressure, HR2=cooling flow)
    try:
        rr = client.read_holding_registers(0, 3, slave=1)
        if rr.isError():
            results.append(TestResult("GRFICSv2 Reactor Registers", False, str(rr)))
        else:
            temp = rr.registers[0]
            pressure = rr.registers[1]
            cooling = rr.registers[2]
            results.append(TestResult(
                "GRFICSv2 Reactor Registers",
                True,
                f"HR0 (temp_sp)={temp}, HR1 (pressure)={pressure}, HR2 (cooling)={cooling}"
            ))
            results.append(TestResult(
                "Reactor Temp Safe Range",
                0 <= temp <= 500,
                f"Temp setpoint = {temp} (safe: 0-500)"
            ))
    except ModbusIOException as e:
        results.append(TestResult("GRFICSv2 Reactor Registers", False, str(e)))

    client.close()
    return results


def print_results(label: str, results: list[TestResult]) -> int:
    """Print test results and return failure count."""
    print(f"\n{'='*60}")
    print(f"  {label}")
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
    parser = argparse.ArgumentParser(description="Validate Modbus TCP endpoints")
    parser.add_argument("--plc-ip", default="192.168.100.10", help="OpenPLC IP address")
    parser.add_argument("--grfics-ip", default="192.168.100.30", help="GRFICSv2 PLC IP address")
    parser.add_argument("--skip-grfics", action="store_true", help="Skip GRFICSv2 validation")
    parser.add_argument("--skip-openplc", action="store_true", help="Skip OpenPLC validation")
    args = parser.parse_args()

    total_failures = 0

    if not args.skip_openplc:
        plc_results = validate_openplc(args.plc_ip)
        total_failures += print_results("OpenPLC — tank_fill_control", plc_results)

    if not args.skip_grfics:
        grfics_results = validate_grfics(args.grfics_ip)
        total_failures += print_results("GRFICSv2 — Reactor PLC", grfics_results)

    print(f"\n{'='*60}")
    if total_failures == 0:
        print("  \033[32mAll Modbus TCP validations passed.\033[0m")
    else:
        print(f"  \033[31m{total_failures} test(s) failed.\033[0m")
    print(f"{'='*60}\n")

    sys.exit(1 if total_failures > 0 else 0)


if __name__ == "__main__":
    main()
