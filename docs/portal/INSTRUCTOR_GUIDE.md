# Instructor Guide — Lab Portal

**Role required**: instructor or admin  
**Access**: http://172.16.0.10:3000 → log in → redirected to /admin

---

## Dashboard Overview

The Admin page has four tabs:

| Tab | Purpose |
|---|---|
| **Users** | Register students, approve pending accounts, manage roles and status |
| **Lab Slots** | Deploy, destroy, reset, and monitor all 20 student lab slots |
| **Console Monitor** | View any running VM in the environment in real time |
| **Audit Log** | All instructor/admin actions with timestamps (admin-only tab) |

---

## Managing Students

### Register a Student Yourself
Admin → Users → **Add User** button  
Fill in: Full Name, Email, Username, Password, Role (Student), Student ID (optional)  
The account is created as **active** and assigned the next available lab slot automatically.

### Approve a Self-Registered Student
When a student registers via `/register`, their account appears with **PENDING** status.  
Admin → Users → find the pending user → **Approve** button  
The student is assigned the next available slot and can log in immediately.

### Bulk Approve
Admin → Users → filter by Status: Pending → select all → **Approve Selected**  
Useful at the start of a class when many students register at once.

### Assign a Student to a Specific Slot
Admin → Users → find user → **Edit** → Lab Slot dropdown → select slot number → Save  
Only works if the target slot is empty.

### Lock / Unlock an Account
Admin → Users → find user → **Lock** (prevents login) or **Unlock** (restores access)  
Use Lock during exams to prevent students from accessing the lab outside designated hours.

### Reset a Password
Admin → Users → find user → **Reset Password** → a temporary password is generated  
The student must change it on first login.  
If EMAIL_MODE=console, the reset link appears in the server log: `pm2 logs portal-backend`

### Delete a Student
Admin → Users → find user → **Delete** (requires confirmation)  
Soft-deletes the account (status = deleted, slot freed). The student cannot log in.

---

## Lab Slot Management

### The 20-Slot Grid
Admin → Lab Slots shows all 20 slots as cards with live status:

| Status color | Meaning |
|---|---|
| 🟢 Green | Running — lab is deployed and VMs are up |
| 🟡 Amber | Deploying or Destroying — Terraform is running |
| 🔴 Red | Error — deployment failed, check slot deploy log |
| ⬜ Gray | Empty — no scenario deployed |

### Deploy a Scenario to One Slot
Admin → Lab Slots → Slot N card → **Deploy** button  
Select scenario from dropdown → **Confirm**  
The terminal panel streams live Terraform + Ansible output.  
Deployment takes 3–5 minutes. The slot turns green when ready.

### Deploy the Same Scenario to All Active Slots
Admin → Lab Slots → **Deploy All** button (top of page)  
Select a scenario → **Confirm**  
All slots with assigned students are deployed simultaneously.  
Monitor progress in the slot grid — each turns green as it completes.

### Reset a Slot to Baseline (Between Student Groups)
Admin → Lab Slots → Slot N → **Reset** button  
Rolls all VMs back to their baseline snapshot.  
Takes ~30 seconds per slot. Faster than destroy + redeploy.  
Use this between back-to-back student groups to restore a clean state.

### Destroy a Slot Lab
Admin → Lab Slots → Slot N → **Destroy** (requires typing the slot name to confirm)  
All VMs are terminated. Slot returns to empty state.  
Student is kept in the Users table but their lab_slot is freed.

### View Slot Deploy Log
Admin → Lab Slots → Slot N → **View Log**  
Shows the full Terraform + Ansible output from the most recent deploy.  
Use this to diagnose a slot stuck in error state.

---

## VM Console Access

### Watch a Single Student's VM
Admin → Lab Slots → Slot N → any VM card → **Console** button  
Opens the VM console in a full-page view with read-only toggle.  
Use read-only mode to observe without interfering.

### Console Monitor (Multi-View)
Admin → Console Monitor tab  
All running VMs appear as thumbnails in a grid, organized by student slot.  
Click any thumbnail to expand it to full view.  
The grid auto-updates as VMs start and stop.

### Take Control of a Student's VM
In the Console viewer, toggle **Watch Only** → off  
You now have keyboard and mouse input to the VM.  
Use for demonstrations or to assist a stuck student.

---

## Sending Hints to Students

Admin → Lab Slots → Slot N → **Send Hint** button  
Type the hint message → Submit  
The student sees the hint in their dashboard within seconds via the WebSocket feed.  
Hints are time-stamped. Students can mark them as read.

---

## Monitoring Student Progress

Admin → Lab Slots → Slot N → **Progress** tab  
Shows which objectives the student has self-reported as completed, with timestamps.  
This is self-reported — it reflects what the student claims, not verified completion.  
For verified completion, check the VM console or scenario-specific artifacts.

---

## Common Classroom Workflows

### Start of Class
1. Verify all students are registered and approved: Admin → Users → filter Active
2. Deploy scenarios: Admin → Lab Slots → Deploy All → select scenario
3. Wait for all slots to turn green (~5 minutes)
4. Print or post student access credentials from each slot card

### Between Student Groups (Same Day)
1. Admin → Lab Slots → Reset All (button at top of page)
2. Wait ~2 minutes for all slots to roll back to baseline
3. New group can start immediately

### End of Class / Day
1. Admin → Lab Slots → Destroy All (requires confirmation)
2. All VMs terminated, compute resources freed
3. Redeploy before next class

### Student Locked Out / Password Forgotten
Admin → Users → find student → Reset Password → give them the temporary password
