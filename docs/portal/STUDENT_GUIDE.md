# Student Guide — Lab Portal

**Access**: http://172.16.0.10:3000

---

## Getting Started

### Step 1 — Register

Navigate to `http://172.16.0.10:3000/register`

Fill in the registration form:
- **Full Name** — your name as it appears on your course roster
- **Email** — use your institutional email or the one your instructor specified
- **Username** — 3–50 characters, letters/numbers/underscores/hyphens only
- **Password** — minimum 12 characters, must include uppercase, lowercase, number, and special character
- **Student ID** — optional, enter if your instructor requested it

After submitting, your account is **pending** until your instructor approves it.  
Once approved, you will receive a notification or your instructor will let you know.

### Step 2 — Log In

Navigate to `http://172.16.0.10:3000` and enter your email and password.  
You will be directed to your student dashboard.

---

## Your Dashboard

The dashboard has three sections:

### Current Scenario
Shows the scenario your instructor has assigned to your lab slot:
- **Scenario name and description**
- **Difficulty and estimated duration**
- **MITRE ATT&CK techniques** covered (for reference)
- **Objectives list** — what you need to accomplish

### My Lab
Shows the status of your lab environment:
- **Running** — your VMs are deployed and ready
- **Deploying** — your lab is being set up (wait 3–5 minutes)
- **Not Deployed** — contact your instructor

### My Consoles
Cards for each VM you have access to in your lab:
- **Attacker VM** (Kali Linux) — your attack platform
- **Target VMs** — the systems you are attacking

Click **Connect** on any VM card to open the console in your browser.

---

## Using the VM Console

### Connecting
1. Click **Connect** on a VM card in your dashboard
2. The console opens in a new page — allow ~5 seconds to connect
3. You should see the VM's desktop or terminal

### Keyboard Shortcuts
The console captures most keyboard input. Some shortcuts:

| Action | How to do it |
|---|---|
| Paste clipboard text | Ctrl+Alt+Shift (opens clipboard panel) → paste → close panel |
| Full screen | Click the **⤢** icon in the toolbar |
| Disconnect | Click the **✕** icon in the toolbar or close the tab |
| Ctrl+Alt+Del | Click the **⌨** icon in the toolbar |

### If the Console Shows a Black Screen
The VM may be sleeping. Click anywhere in the console window and press Enter.  
If still black after 30 seconds, contact your instructor.

---

## Tracking Your Objectives

In the **Current Scenario** section, check off objectives as you complete them:
1. Click the checkbox next to an objective
2. The timestamp is recorded automatically
3. Your instructor can see your progress

**Important**: Checking an objective is self-reported. Your instructor may verify your
work by viewing your VM console or checking artifacts on the target systems.

---

## Receiving Hints

If your instructor sends you a hint, it appears in a **Hints** banner at the top of your
dashboard. Hints include a timestamp and are listed in order.  
Click **Mark as Read** to dismiss a hint after you have reviewed it.

---

## Changing Your Password

Click your username in the top-right corner → **Profile** → **Change Password**  
Enter your current password, then your new password (same requirements as registration).

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Console won't connect | Refresh the page. If still failing, contact your instructor — the VM may need to be reset |
| Dashboard shows "Not Deployed" | Your lab hasn't been set up yet — contact your instructor |
| Wrong scenario showing | Your instructor may be updating your assignment — check again in a few minutes |
| Forgot password | On the login page, click **Forgot Password** — enter your email and follow the instructions, or ask your instructor to reset it |
| Account locked | Contact your instructor |

---

## What You Cannot Do

- View other students' VMs or lab environments
- Access the instructor admin panel
- Change your own role or lab slot assignment
- Deploy or destroy your lab (only your instructor can do this)
