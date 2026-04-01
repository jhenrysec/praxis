#!/usr/bin/env python3
"""Modbus-to-InfluxDB historian bridge.

Polls OpenPLC and GRFICSv2 Modbus registers at configurable intervals
and writes process data to InfluxDB for historian functionality and
Grafana dashboard display.

Runs as a systemd service on the historian VM.

Configuration via environment variables:
    OPENPLC_HOST        OpenPLC IP (default: 192.168.100.10)
    GRFICS_HOST         GRFICSv2 PLC IP (default: 192.168.100.30)
    INFLUXDB_URL        InfluxDB API URL (default: http://127.0.0.1:8086)
    INFLUXDB_TOKEN      InfluxDB API token (required)
    INFLUXDB_ORG        InfluxDB organization (default: scada-lab)
    POLL_INTERVAL_MS    Poll interval in milliseconds (default: 1000)
"""

import os
import sys
import time
import signal
import logging
from datetime import datetime, timezone
from typing import Optional

try:
    from pymodbus.client import ModbusTcpClient
except ImportError:
    print("ERROR: pymodbus not installed. Run: pip3 install pymodbus>=3.7.0")
    sys.exit(1)

try:
    from influxdb_client import InfluxDBClient, Point, WritePrecision
    from influxdb_client.client.write_api import SYNCHRONOUS
except ImportError:
    print("ERROR: influxdb-client not installed. Run: pip3 install influxdb-client>=1.40.0")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("modbus_historian")

# Graceful shutdown
running = True


def signal_handler(_sig: int, _frame) -> None:
    global running
    log.info("Shutdown signal received")
    running = False


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


class ModbusPoller:
    """Polls Modbus registers from a single PLC endpoint."""

    def __init__(self, host: str, port: int = 502, slave_id: int = 1,
                 name: str = "plc"):
        self.host = host
        self.port = port
        self.slave_id = slave_id
        self.name = name
        self.client: Optional[ModbusTcpClient] = None
        self.connected = False

    def connect(self) -> bool:
        if self.client is None:
            self.client = ModbusTcpClient(self.host, port=self.port, timeout=3)
        if not self.connected:
            self.connected = self.client.connect()
            if self.connected:
                log.info("Connected to %s at %s:%d", self.name, self.host, self.port)
            else:
                log.warning("Cannot connect to %s at %s:%d", self.name, self.host, self.port)
        return self.connected

    def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.connected = False

    def read_openplc_registers(self) -> Optional[dict]:
        """Read tank_fill_control registers from OpenPLC."""
        if not self.connect():
            return None
        try:
            data: dict = {}

            # Coils (FC01): 0-2
            rr = self.client.read_coils(address=0, count=3)
            if not rr.isError():
                data["pump_enable"] = rr.bits[0]
                data["alarm_high"] = rr.bits[1]
                data["alarm_low"] = rr.bits[2]

            # Input registers (FC04): 0 = tank level sensor
            rr = self.client.read_input_registers(address=0, count=1)
            if not rr.isError():
                data["tank_level"] = rr.registers[0]

            # Holding registers (FC03): 0 = pump speed
            rr = self.client.read_holding_registers(address=0, count=1)
            if not rr.isError():
                data["pump_speed"] = rr.registers[0]

            # Memory words (FC03): 1024-1026 = setpoint, alarm thresholds
            rr = self.client.read_holding_registers(address=1024, count=3)
            if not rr.isError():
                data["setpoint"] = rr.registers[0]
                data["alarm_high_threshold"] = rr.registers[1]
                data["alarm_low_threshold"] = rr.registers[2]

            return data if data else None
        except Exception as e:
            log.error("Error reading %s: %s", self.name, e)
            self.connected = False
            return None

    def read_grfics_registers(self) -> Optional[dict]:
        """Read GRFICSv2 reactor registers."""
        if not self.connect():
            return None
        try:
            rr = self.client.read_holding_registers(address=0, count=3)
            if rr.isError():
                return None
            return {
                "reactor_temp": rr.registers[0],
                "reactor_pressure": rr.registers[1],
                "cooling_flow": rr.registers[2],
            }
        except Exception as e:
            log.error("Error reading %s: %s", self.name, e)
            self.connected = False
            return None


def write_to_influxdb(
    write_api,
    measurement: str,
    bucket: str,
    fields: dict,
    tags: Optional[dict] = None,
) -> None:
    """Write a single data point to InfluxDB."""
    point = Point(measurement).time(datetime.now(timezone.utc), WritePrecision.MS)
    if tags:
        for k, v in tags.items():
            point = point.tag(k, v)
    for k, v in fields.items():
        if isinstance(v, bool):
            point = point.field(k, v)
        elif isinstance(v, int):
            point = point.field(k, float(v))
        elif isinstance(v, float):
            point = point.field(k, v)
    write_api.write(bucket=bucket, record=point)


def main() -> None:
    # Configuration from environment
    openplc_host = os.environ.get("OPENPLC_HOST", "192.168.100.10")
    grfics_host = os.environ.get("GRFICS_HOST", "192.168.100.30")
    influxdb_url = os.environ.get("INFLUXDB_URL", "http://127.0.0.1:8086")
    influxdb_token = os.environ.get("INFLUXDB_TOKEN", "")
    influxdb_org = os.environ.get("INFLUXDB_ORG", "scada-lab")
    poll_interval_ms = int(os.environ.get("POLL_INTERVAL_MS", "1000"))

    if not influxdb_token:
        # Try reading from token file
        token_file = os.environ.get("INFLUXDB_TOKEN_FILE", "/etc/influxdb2/lab-token")
        try:
            with open(token_file) as f:
                influxdb_token = f.read().strip()
        except FileNotFoundError:
            log.error("INFLUXDB_TOKEN not set and %s not found", token_file)
            sys.exit(1)

    poll_interval = poll_interval_ms / 1000.0

    log.info("Modbus Historian Bridge starting")
    log.info("  OpenPLC:  %s:502", openplc_host)
    log.info("  GRFICSv2: %s:502", grfics_host)
    log.info("  InfluxDB: %s (org=%s)", influxdb_url, influxdb_org)
    log.info("  Poll:     %dms", poll_interval_ms)

    # Connect to InfluxDB
    influx_client = InfluxDBClient(
        url=influxdb_url,
        token=influxdb_token,
        org=influxdb_org
    )
    write_api = influx_client.write_api(write_options=SYNCHRONOUS)

    # Create Modbus pollers
    openplc = ModbusPoller(openplc_host, name="OpenPLC") if openplc_host else None
    grfics = ModbusPoller(grfics_host, name="GRFICSv2") if grfics_host else None

    poll_count = 0
    error_count = 0

    while running:
        loop_start = time.monotonic()

        # Poll OpenPLC
        if openplc:
            data = openplc.read_openplc_registers()
            if data:
                write_to_influxdb(
                    write_api,
                    measurement="openplc",
                    bucket="process-data",
                    fields=data,
                    tags={"host": openplc_host, "program": "tank_fill_control"},
                )
            else:
                error_count += 1

        # Poll GRFICSv2
        if grfics:
            data = grfics.read_grfics_registers()
            if data:
                write_to_influxdb(
                    write_api,
                    measurement="grfics",
                    bucket="grfics-data",
                    fields=data,
                    tags={"host": grfics_host, "unit": "reactor"},
                )
            else:
                error_count += 1

        poll_count += 1
        if poll_count % 60 == 0:
            log.info("Poll count: %d, errors: %d", poll_count, error_count)

        # Sleep for remaining interval
        elapsed = time.monotonic() - loop_start
        sleep_time = max(0, poll_interval - elapsed)
        if sleep_time > 0:
            time.sleep(sleep_time)

    # Cleanup
    if openplc:
        openplc.disconnect()
    if grfics:
        grfics.disconnect()
    influx_client.close()
    log.info("Historian bridge stopped (polls=%d, errors=%d)", poll_count, error_count)


if __name__ == "__main__":
    main()
