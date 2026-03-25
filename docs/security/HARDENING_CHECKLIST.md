# Hardening Checklist

**Maintained by**: SECURITY_AGENT  
**Scope**: Proxmox host management plane only — lab segments are intentionally vulnerable  
**Updated**: after each `/security` hardening task

---

## Proxmox Host

### SSH

- [ ] Password authentication disabled (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- [ ] Root login via password disabled (`PermitRootLogin prohibit-password`)
- [ ] SSH restricted to management subnet only (firewall rule on vmbr0)
- [ ] `MaxAuthTries 3` set
- [ ] SSH key type: ed25519 only (no RSA < 4096, no DSA)

### Web UI (Port 8006)

- [ ] Access restricted to management subnet via Proxmox datacenter firewall
- [ ] Default root password changed from installer default
- [ ] Two-factor authentication enabled for root (optional but recommended)

### fail2ban

- [ ] Installed and running: `systemctl status fail2ban`
- [ ] SSH jail active: `fail2ban-client status sshd`
- [ ] pveproxy jail active: `fail2ban-client status pveproxy`
- [ ] Ban threshold: 5 attempts, 15-minute ban

### Updates

- [ ] `unattended-upgrades` installed and configured for security packages
- [ ] Proxmox packages updated: `apt full-upgrade`
- [ ] Kernel updates applied and system rebooted

### Secrets and Credentials

- [ ] Terraform API token created for `terraform@pve` (not root)
- [ ] Root password stored in password manager (not in any file)
- [ ] Terraform token stored only in `lab-env.local.sh` (gitignored)
- [ ] No plain-text credentials in any committed file
- [ ] API token rotation scheduled (quarterly)

### Network Isolation

- [ ] vmbr0 has no routes to vmbr1, vmbr2, or vmbr3
- [ ] Proxmox datacenter firewall enabled with `policy_in: DROP`
- [ ] Verified: VM on vmbr1 cannot reach 172.16.0.10 (test with ping)
- [ ] Verified: VM on vmbr3 cannot reach 172.16.0.10

### Logging

- [ ] `/var/log/auth.log` monitored
- [ ] Proxmox audit log active (`/var/log/pve-audit.log`)

---

## Completion Record

| Check | Completed | Agent | Date |
|---|---|---|---|
| SSH hardening | ⬜ | SECURITY_AGENT | — |
| Firewall default-deny | ⬜ | SECURITY_AGENT | — |
| fail2ban install | ⬜ | SECURITY_AGENT | — |
| Credential audit | ⬜ | SECURITY_AGENT | — |
| Network isolation test | ⬜ | SECURITY_AGENT | — |

*Run `/security audit proxmox host hardening` to verify and update this checklist.*
