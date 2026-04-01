import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getIp } from '../../utils/request.js';
import { proxmoxService } from '../../services/proxmox.js';
import { consoleService } from '../../services/console.js';
import { writeAuditLog } from '../middleware/auditLog.js';

export const consolesRouter = Router();

consolesRouter.use(authenticate);

// ── GET /vms — list VMs accessible to the current user ───────────────────────

consolesRouter.get('/vms', async (req, res, next) => {
  try {
    if (req.user!.role === 'student') {
      if (!req.user!.lab_slot) {
        res.json({ vms: [] });
        return;
      }
      const vms = await proxmoxService.getVMsForSlot(req.user!.lab_slot);
      res.json({ vms });
    } else {
      // Instructors/admins see all lab VMs
      const vms = await proxmoxService.getVMs();
      // Filter to only lab VMs (tagged with student-slot-*)
      const labVMs = vms.filter((vm) => vm.tags?.includes('student-slot-'));
      res.json({ vms: labVMs });
    }
  } catch (err) {
    next(err);
  }
});

// ── POST /ticket — request VNC ticket for a specific VM ──────────────────────

const ticketSchema = z.object({
  vmId: z.number().int().min(100).max(999),
});

consolesRouter.post('/ticket', validate(ticketSchema), async (req, res, next) => {
  try {
    const { vmId } = req.body as z.infer<typeof ticketSchema>;

    // Validate ownership: students can only access VMs in their slot
    if (req.user!.role === 'student') {
      if (!req.user!.lab_slot) {
        res.status(403).json({ error: 'No slot assigned' });
        return;
      }
      const slotVMs = await proxmoxService.getVMsForSlot(req.user!.lab_slot);
      const allowed = slotVMs.some((vm) => vm.vmid === vmId);
      if (!allowed) {
        res.status(403).json({ error: 'Access denied to this VM' });
        return;
      }
    }

    const ticket = await consoleService.getTicket(vmId);

    await writeAuditLog(
      req.user!.id,
      'console_access',
      'vm',
      String(vmId),
      null,
      getIp(req),
    );

    res.json({ ticket: ticket.ticket, wsUrl: ticket.wsUrl, port: ticket.port });
  } catch (err) {
    next(err);
  }
});
