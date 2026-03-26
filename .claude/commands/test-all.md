# /test-all — Run All Validation Checks

Run every validation and test across the entire project. Fix all failures before reporting done.

Scope: $ARGUMENTS
(Leave blank for full project scan. Pass a path or phase name to scope it.)

## Validation Sequence

### 1. Terraform Validation (all scenario directories)
```bash
for dir in scenarios/*/; do
  echo "=== Validating $dir ==="
  cd "$dir"
  terraform init -backend=false -input=false
  terraform validate
  cd -
done
```
Fix any errors before continuing.

### 2. Packer Validation (all templates)
```bash
for tpl in packer/templates/*.pkr.hcl; do
  echo "=== Validating $tpl ==="
  packer validate -var-file=packer/variables.pkrvars.hcl "$tpl"
done
```
Fix any errors before continuing.

### 3. Ansible Lint (all playbooks and roles)
```bash
ansible-lint ansible/
```
Fix all violations at WARN level and above. INFO level: document and skip if intentional.

### 4. TypeScript Build (lab UI)
```bash
cd lab-ui && npm run build 2>&1
```
Zero TypeScript errors required. Zero Vite build errors required.

### 5. Go Build (toolkit suite)
```bash
find . -name "go.mod" -execdir go build ./... \;
find . -name "go.mod" -execdir go vet ./... \;
```

### 6. Markdown Lint (docs)
```bash
find docs/ -name "*.md" | head -20
# Check: all scenario cards have required sections
# Check: CHANGELOG.md has entries (not just template)
# Check: VERSION_MANIFEST.md has no empty version cells
```

### 7. Secret Scan
```bash
# Check for accidentally committed secrets
grep -rn "password\s*=\s*['\"][^${\(]" --include="*.tf" --include="*.hcl" . | grep -v "example\|test\|sample" | head -20
grep -rn "api_token\s*=\s*['\"]" --include="*.tf" . | grep -v "var\.\|local\.\|example" | head -20
grep -rn "ANTHROPIC_API_KEY\s*=" --include="*.json" --include="*.env" . 2>/dev/null | head -5
```
Any hit here is a 🔒 SECURITY hard stop — fix before continuing.

### 8. Network Config Sanity
Verify the four bridge definitions exist in the expected network config files:
- vmbr0 (172.16.0.0/24) — management
- vmbr1 (10.10.1.0/24) — red zone
- vmbr2 (10.10.2.0/24) — blue zone
- vmbr3 (192.168.100.0/24) — OT zone

### 9. Quality Gate Report
After all checks, output a summary table:

```
╔══════════════════════════════════════════════╗
║           TEST-ALL RESULTS                   ║
╠══════════════════════════╦═══════════════════╣
║ Check                    ║ Status            ║
╠══════════════════════════╬═══════════════════╣
║ Terraform validate       ║ ✅ PASS / ❌ FAIL ║
║ Packer validate          ║ ✅ PASS / ❌ FAIL ║
║ Ansible lint             ║ ✅ PASS / ❌ FAIL ║
║ TypeScript build         ║ ✅ PASS / ❌ FAIL ║
║ Go build + vet           ║ ✅ PASS / ❌ FAIL ║
║ Docs completeness        ║ ✅ PASS / ❌ FAIL ║
║ Secret scan              ║ ✅ PASS / ❌ FAIL ║
║ Network config           ║ ✅ PASS / ❌ FAIL ║
╚══════════════════════════╩═══════════════════╝
```

If ANY check fails: fix it, then re-run that specific check before reporting done.
After all pass: /docs "test-all passed — all validation checks clean"
