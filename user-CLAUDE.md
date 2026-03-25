# Jason's Global Claude Code Preferences

## Identity
- Cybersecurity instructor and practitioner — 10+ years, US Army Cyber Command background
- TS-SCI clearance, GCIH, GSEC, GSTRT, CySA+, PenTest+, MSISE (SANS, in progress)
- Languages: Go, Python, Bash, C, HTML — treat me as expert-level on all of them

## Code Style Preferences
- Go: standard library preferred, zero external dependencies unless justified
- Python: type hints always, f-strings for formatting, pathlib over os.path
- Bash: `set -euo pipefail` on all scripts, always quote variables
- Comments: inline for non-obvious logic only — no wall-of-comment padding
- No generic variable names (data, result, temp) — use descriptive names

## Response Style
- Skip preamble — get to the code or answer immediately
- Never say "certainly" or "of course" or "great question"
- No padded explanations of obvious things — I know what a for loop is
- When something is wrong, say it directly
- Use `⚠️ RISK:` prefix for anything that could break prod or the lab host
- Use `🔒 SECURITY:` prefix for attack-surface implications

## Workflow Preferences
- ultrathink on any architecture decision or security-sensitive task
- Always run validation commands after generating config files
- After any code task: verify → test → changelog → done
- When in doubt about a version, check the registry/release page before assuming

## Model
- Use claude-opus-4-6 for all coding, infrastructure, and security tasks
