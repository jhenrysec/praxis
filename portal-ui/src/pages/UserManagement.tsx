import { useState } from 'react';
import { useUsers, usePendingUsers, useUserMutations } from '../hooks/useAdmin';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useAuthStore } from '../stores/authStore';
import {
  UserCheck, UserX, Lock, Unlock, KeyRound, Trash2, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { User } from '../types';

export function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data: usersData, isLoading } = useUsers({ role: roleFilter || undefined, status: statusFilter || undefined, page });
  const { data: pendingData } = usePendingUsers();
  const mutations = useUserMutations();

  const users = usersData?.users ?? [];
  const pagination = usersData?.pagination;
  const pendingCount = pendingData?.users?.length ?? 0;

  const handleAction = async (action: string, user: User) => {
    switch (action) {
      case 'approve': mutations.approve.mutate(user.id); break;
      case 'lock': mutations.lock.mutate(user.id); break;
      case 'unlock': mutations.unlock.mutate(user.id); break;
      case 'delete':
        if (confirm(`Delete user ${user.username}?`)) mutations.deleteUser.mutate(user.id);
        break;
      case 'reset-password': {
        const result = await mutations.resetPassword.mutateAsync(user.id);
        setTempPassword(result.temporary_password);
        break;
      }
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">User Management</h1>
          {pendingCount > 0 && (
            <p className="text-[var(--accent-amber)] text-sm mt-1">
              {pendingCount} pending registration{pendingCount > 1 ? 's' : ''} awaiting approval
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[var(--accent-green)] text-[var(--bg-base)] px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Temp password display */}
      {tempPassword && (
        <div className="bg-[#facc151a] border border-[#facc1533] rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <div>
            <span className="text-[var(--accent-amber)] text-sm font-semibold">Temporary Password: </span>
            <code className="text-[var(--text-primary)] bg-[var(--bg-base)] px-2 py-1 rounded">{tempPassword}</code>
          </div>
          <button onClick={() => setTempPassword(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
          aria-label="Filter by role"
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      {/* Users table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)]">
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">User</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Role</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Status</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Slot</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Last Login</th>
              <th className="label-mono text-[var(--text-muted)] text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">No users found</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)]">
                  <td className="px-4 py-3">
                    <div className="text-[var(--text-primary)]">{u.full_name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="label-mono text-[var(--accent-blue)]">{u.role}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {u.lab_slot ? `#${u.lab_slot}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.status === 'pending' && (
                        <button onClick={() => handleAction('approve', u)} className="p-1.5 rounded hover:bg-[#00e5a01a] text-[var(--accent-green)]" title="Approve" aria-label="Approve user">
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {u.status === 'active' && u.id !== currentUser?.id && (
                        <button onClick={() => handleAction('lock', u)} className="p-1.5 rounded hover:bg-[#fb71851a] text-[var(--text-muted)] hover:text-[var(--accent-red)]" title="Lock" aria-label="Lock user">
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      {u.status === 'locked' && (
                        <button onClick={() => handleAction('unlock', u)} className="p-1.5 rounded hover:bg-[#00e5a01a] text-[var(--text-muted)] hover:text-[var(--accent-green)]" title="Unlock" aria-label="Unlock user">
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleAction('reset-password', u)} className="p-1.5 rounded hover:bg-[#facc151a] text-[var(--text-muted)] hover:text-[var(--accent-amber)]" title="Reset Password" aria-label="Reset password">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleAction('delete', u)} className="p-1.5 rounded hover:bg-[#fb71851a] text-[var(--text-muted)] hover:text-[var(--accent-red)]" title="Delete" aria-label="Delete user">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[var(--text-muted)]">
            {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pagination.limit >= pagination.total}
              className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const mutations = useUserMutations();
  const [form, setForm] = useState({
    email: '', username: '', password: '', full_name: '', student_id: '', role: 'student',
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await mutations.createUser.mutateAsync({
        email: form.email,
        username: form.username,
        password: form.password,
        full_name: form.full_name,
        student_id: form.student_id || undefined,
        role: form.role,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create User</h2>
        {error && (
          <div className="bg-[#fb71851a] border border-[#fb718533] rounded-lg px-3 py-2 mb-4 text-[var(--accent-red)] text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Full Name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm" />
          <input type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm" />
          <input type="text" placeholder="Username" required minLength={3} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm" />
          <input type="password" placeholder="Password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm" />
          <input type="text" placeholder="Student ID (optional)" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm" aria-label="User role">
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg py-2 text-sm hover:bg-[var(--bg-hover)]">Cancel</button>
            <button type="submit" disabled={mutations.createUser.isPending} className="flex-1 bg-[var(--accent-green)] text-[var(--bg-base)] rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {mutations.createUser.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
