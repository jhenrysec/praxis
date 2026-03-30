# Skill: Scenario Dressing and Artifact Content Generation

**Applies to**: CONTENT_AGENT
**Dependencies**: @skills/docx · @skills/xlsx · @skills/pdf
**Output location**: scenarios/<name>/ansible/roles/<task>/files/
**Last reviewed**: 2026-03

---

## Generation Pipeline

### Step 1: Parse the Content Brief

Read the `dressing_assets` section of the intel brief YAML. For each asset:

```yaml
# Extract these fields:
id:              DRESS-001           # tracking ID
host_role:       victim_workstation  # which VM receives the file
type:            document            # content category
filename:        "Report.docx"       # exact output filename
file_path:       "C:\\..."           # where Ansible drops it (informational)
format:          docx                # output format → selects generation skill
content_brief:   "..."               # CREATIVE DIRECTION — your primary input
sector_references: [...]             # terminology to use
training_purpose: clue               # how students interact with it
generates_via:   docx_skill          # which skill to invoke
ansible_task:    stage-dressing-ews  # which Ansible role deploys it
```

### Step 2: Select Generation Method

| format | Method | Skill Reference |
|--------|--------|-----------------|
| docx | Node.js docx library | @skills/docx/SKILL.md |
| xlsx | Node.js ExcelJS or Python openpyxl | @skills/xlsx/SKILL.md |
| pdf | Python reportlab or HTML→PDF | @skills/pdf/SKILL.md |
| txt | Direct file write | None needed |
| csv | Python csv module | None needed |
| json | Python json module | None needed |
| xml | Python xml.etree | None needed |
| reg | Direct file write (Windows registry format) | None needed |
| evtx | Pre-built event log injection script | See Artifact Staging below |
| pcap | Python scapy | See PCAP Generation below |
| ps1 | Direct file write (PowerShell simulation) | See Simulated Artifacts below |
| vbs | Direct file write (VBScript simulation) | See Simulated Artifacts below |

### Step 3: Generate Content

Follow the generation skill's patterns exactly. Key rules per format:

#### DOCX Generation
```bash
# Install dependency
npm install -g docx

# Generate via Node.js script
node generate_dressing.js
```

```javascript
// generate_dressing.js — template for document generation
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
        WidthType, PageNumber } = require('docx');
const fs = require('fs');

// Build document structure from content brief
const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "MERIDIAN POLICY RESEARCH INSTITUTE",
                bold: true, size: 20, font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "INTERNAL — NOT FOR DISTRIBUTION",
                color: "FF0000", size: 16, font: "Arial",
              }),
            ],
          }),
        ],
      }),
    },
    children: [
      // Title
      new Paragraph({
        children: [
          new TextRun({
            text: "Document Title Here",
            bold: true, size: 28, font: "Arial",
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }),
      // Body paragraphs...
    ],
  }],
});

// Write to the correct Ansible files directory
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("scenarios/<name>/ansible/roles/stage-dressing-ews/files/Document.docx", buffer);
});
```

After generation, validate:
```bash
python /mnt/skills/public/docx/scripts/office/validate.py output.docx
```

#### XLSX Generation
```bash
npm install -g exceljs
```

```javascript
const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Contact List');

// Set columns
sheet.columns = [
  { header: 'Full Name', key: 'name', width: 25 },
  { header: 'Title', key: 'title', width: 30 },
  { header: 'Organization', key: 'org', width: 30 },
  { header: 'Email', key: 'email', width: 35 },
  { header: 'Country', key: 'country', width: 15 },
];

// Header styling
sheet.getRow(1).font = { bold: true, size: 11, name: 'Arial' };
sheet.getRow(1).fill = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
};
sheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

// Add data rows
const contacts = [
  { name: 'Ambassador Khalid Al-Rashid', title: 'Senior Diplomatic Advisor',
    org: 'Gulf Cooperation Council', email: 'k.alrashid@gcc-sim.org',
    country: 'Saudi Arabia' },
  // ... more rows
];
contacts.forEach(c => sheet.addRow(c));

workbook.xlsx.writeFile('output.xlsx');
```

#### PDF Generation
Use HTML-to-PDF for complex layouts:
```bash
pip install weasyprint --break-system-packages
```

```python
from weasyprint import HTML

html_content = """
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 2cm; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .org-name { font-size: 18pt; font-weight: bold; }
  .classification { color: red; font-size: 10pt; }
  h1 { font-size: 14pt; margin-top: 20px; }
  p { font-size: 11pt; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
  th { background: #4472C4; color: white; }
</style></head>
<body>
  <div class="header">
    <div class="org-name">ORGANIZATION NAME</div>
    <div class="classification">INTERNAL — NOT FOR DISTRIBUTION</div>
  </div>
  <!-- Content from brief -->
</body>
</html>
"""

HTML(string=html_content).write_pdf('output.pdf')
```

#### Email Thread Generation (txt)
```python
# generate_email_thread.py
from datetime import datetime, timedelta

emails = [
    {
        "from": "a.rezaei@khalejtimes.org",  # typosquatted domain
        "to": "s.mitchell@meridian-policy.org",
        "date": datetime(2024, 1, 10, 9, 23),
        "subject": "Interview Request — Gulf Security Forum",
        "body": """Dear Dr. Mitchell,

I hope this message finds you well. My name is Ahmad Rezaei, and I am a
senior correspondent covering Middle East security affairs for Khaleej Times.

I am preparing a feature piece on evolving Gulf security architecture and
would very much appreciate your perspective as a leading voice on Iran
nuclear policy. Would you be available for a brief conversation next week?

Best regards,
Ahmad Rezaei
Senior Correspondent — Security & Defense
Khaleej Times
+971-4-XXX-XXXX"""
    },
    # ... subsequent emails building trust, then delivering phishing link
]

with open('email_thread.txt', 'w') as f:
    for i, email in enumerate(reversed(emails)):
        if i > 0:
            f.write("\n" + "="*60 + "\n\n")
        f.write(f"From: {email['from']}\n")
        f.write(f"To: {email['to']}\n")
        f.write(f"Date: {email['date'].strftime('%a, %d %b %Y %H:%M:%S +0000')}\n")
        f.write(f"Subject: {email['subject']}\n")
        f.write(f"Message-ID: <{hash(email['body']) & 0xFFFFFFFF:08x}@{email['from'].split('@')[1]}>\n")
        f.write(f"\n{email['body']}\n")
```

### Step 4: Validate Output

After generating each file:

```bash
# DOCX validation
python /mnt/skills/public/docx/scripts/office/validate.py output.docx

# XLSX validation — open and verify
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('output.xlsx')
for ws in wb.worksheets:
    print(f'{ws.title}: {ws.max_row} rows x {ws.max_column} cols')
"

# PDF validation
python3 -c "
from pypdf import PdfReader
r = PdfReader('output.pdf')
print(f'Pages: {len(r.pages)}')
for i, p in enumerate(r.pages):
    text = p.extract_text()
    print(f'Page {i+1}: {len(text)} chars')
"

# Plain text — check encoding
file output.txt
wc -l output.txt
```

### Step 5: Place in Ansible Directory

```bash
# Create the target directory if it doesn't exist
SCENARIO="apt42_credential_harvest_cloud_exfil"
ROLE="stage-dressing-ews"

mkdir -p "scenarios/${SCENARIO}/ansible/roles/${ROLE}/files"

# Move generated file
mv output.docx "scenarios/${SCENARIO}/ansible/roles/${ROLE}/files/Draft_Policy_Brief.docx"
```

---

## PCAP Generation

For network traffic artifacts (IOC type: network_pcap):

```python
# generate_pcap.py — simulated credential harvesting traffic
from scapy.all import *
from datetime import datetime

packets = []
base_time = datetime(2024, 1, 15, 14, 30, 0).timestamp()

# DNS query for typosquatted domain
dns_query = IP(src="10.10.2.30", dst="10.10.2.20") / \
            UDP(sport=53212, dport=53) / \
            DNS(rd=1, qd=DNSQR(qname="washinqtonpost.press"))
dns_query.time = base_time
packets.append(dns_query)

# DNS response
dns_resp = IP(src="10.10.2.20", dst="10.10.2.30") / \
           UDP(sport=53, dport=53212) / \
           DNS(qr=1, qd=DNSQR(qname="washinqtonpost.press"),
               an=DNSRR(rrname="washinqtonpost.press", rdata="10.10.1.10"))
dns_resp.time = base_time + 0.05
packets.append(dns_resp)

# HTTP GET to credential harvesting page
http_get = IP(src="10.10.2.30", dst="10.10.1.10") / \
           TCP(sport=49152, dport=443, flags="S")
http_get.time = base_time + 0.2
packets.append(http_get)

# ... additional packets showing the credential harvesting flow

wrpcap("kerrdown_harvest_sim.pcap", packets)
```

---

## Windows Event Log Artifact Staging

For pre-staged Windows event log artifacts, produce a PowerShell injection
script that INFRA_AGENT's Ansible role executes on the target VM:

```powershell
# inject_events.ps1 — Stage forensic event log entries
# SIMULATION — for training scenario use only

# Inject Event ID 4688 — Process Creation (enumeration commands)
$events = @(
    @{ Command = "whoami"; Time = "2024-01-15T14:35:12Z" },
    @{ Command = "net view"; Time = "2024-01-15T14:35:18Z" },
    @{ Command = "net share"; Time = "2024-01-15T14:35:25Z" },
    @{ Command = "hostname"; Time = "2024-01-15T14:35:31Z" },
    @{ Command = "net user /domain"; Time = "2024-01-15T14:35:45Z" }
)

foreach ($evt in $events) {
    # Write to a custom event log that students can discover
    Write-EventLog -LogName Application -Source "SimLab" `
        -EventId 4688 -EntryType Information `
        -Message "Process Created: $($evt.Command) at $($evt.Time)"
}
```

---

## Realistic Name Generation Reference

### Western / American Names
```
First: James, Sarah, Michael, Emily, David, Jennifer, Robert, Amanda
Last: Mitchell, Williams, Harrison, Chen, Rodriguez, Thompson, Baker
```

### Middle Eastern / Gulf Region Names
```
Arabic: Ahmad Al-Rashid, Fatima Al-Hamidi, Khalid bin Saeed, Noura Al-Qasimi
Iranian: Reza Mohammadi, Maryam Hosseini, Ali Karimi, Shirin Ebrahimi
Turkish: Mehmet Yilmaz, Ayse Demir, Emre Kaya, Zeynep Arslan
```

### Vietnamese Names
```
Nguyen Van Minh, Tran Thi Hoa, Le Duc Anh, Pham Thu Huong
```

### Israeli Names
```
Yael Cohen, Avi Goldstein, Noa Levi, Eitan Shapiro
```

### European Names
```
British: Oliver Chambers, Eleanor Wright, Thomas Pemberton
French: Pierre Dubois, Isabelle Moreau, Jean-Luc Martin
German: Hans Weber, Claudia Fischer, Stefan Braun
```

Always match name patterns to the scenario's sector and region. A Gulf
security contact list should not have all Western names. A Vietnamese
government staff directory should use Vietnamese naming conventions
(family name first: Nguyen Van Minh, not Van Minh Nguyen).

---

## Common Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| Document looks AI-generated | Perfect grammar, no voice, generic structure | Add realistic imperfections: informal notes, abbreviations, crossed-out edits, "TBD" entries |
| Spreadsheet has round numbers | Generated without variance | Add noise: 287.3 not 287, 62.1 not 62 |
| Email thread feels robotic | All messages same length and tone | Vary length, add typos in quick replies, use different sign-off styles |
| Clue is too obvious | IP address highlighted or in isolation | Embed clue within surrounding legitimate content — students must read to find it |
| Red herring is instantly dismissable | Content is clearly irrelevant | Make the red herring topically adjacent — close enough to investigate, far enough to ultimately rule out |
| Simulated malware triggers AV | Used real obfuscation techniques | Keep simulations simple — no encoding, no obfuscation, clearly commented as simulation |
| File won't open on target VM | Wrong format version or encoding | Test on a Windows VM before committing; use UTF-8 with BOM for Windows text files |
| Names are culturally wrong | Used Western names for non-Western org | Match names to the scenario's region and sector — see name reference above |
