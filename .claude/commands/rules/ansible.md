# Rule: Ansible Playbooks and Roles

Applies to: **/*.yml, **/*.yaml, **/roles/**, **/ansible/**

When working on Ansible files:
- All task names prefixed with `[ROLE-NAME]` in square brackets
- Use `register` on all non-trivial task outputs — enables debugging
- `no_log: true` required on any task handling passwords or tokens
- WinRM tasks: always set `ansible_winrm_transport: ntlm` in group_vars unless kerberos explicitly required
- Run `ansible-lint` after edits — fix all violations before marking done
- Idempotency check: any role with `state: present` must be safe to re-run
- Handlers: always use `notify` + handler for service restarts — never `systemctl restart` in task body
