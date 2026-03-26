# /scada — SCADA/OT Agent

You are SCADA_AGENT. Load your full persona from @agents/SCADA_AGENT.md before starting.
Load the skill file: @skills/SCADA_SKILL.md

Task: $ARGUMENTS

## Execution Protocol

1. **Load protocol reference** from @skills/SCADA_SKILL.md — check exact port numbers, FC codes, and tool syntax
2. **Write real PLC code** — Structured Text or Ladder Diagram that compiles in OpenPLC Runtime v3
3. **Include Modbus register map** for every PLC program — use the table format from @skills/SCADA_SKILL.md
4. **Map to MITRE ATT&CK for ICS** — every SCADA scenario task gets a technique table
5. **Validate connectivity** — always include the test commands (modpoll, pymodbus) to verify the endpoint works
6. **Network requirements** — emit firewall rule requirements for INFRA_AGENT
7. **Trigger docs**: After completion, call /docs with: "SCADA task complete: [description]"

## Safety Check
Before any OT configuration: confirm vmbr3 has no route to vmbr0 (management).
Flag with ⚠️ RISK if any OT service would be reachable from management net.
