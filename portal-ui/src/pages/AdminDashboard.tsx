import { useAuthStore } from '../stores/authStore';
import { Users, Server, BookOpen, ScrollText } from 'lucide-react';

export function AdminDashboard() {
  const { user } = useAuthStore();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-wide mb-2">
        Instructor Dashboard
      </h1>
      <p className="text-[var(--text-secondary)] text-sm mb-8">
        Welcome, {user?.full_name} — {user?.role}
      </p>

      {/* Placeholder cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6">
          <Users className="w-8 h-8 text-[var(--accent-blue)] mb-3" />
          <h3 className="font-semibold mb-1">Users</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Manage students, approvals, and slot assignments.
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6">
          <Server className="w-8 h-8 text-[var(--accent-green)] mb-3" />
          <h3 className="font-semibold mb-1">Lab Slots</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Deploy, destroy, and monitor 20 lab slots.
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6">
          <BookOpen className="w-8 h-8 text-[var(--accent-amber)] mb-3" />
          <h3 className="font-semibold mb-1">Scenarios</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Browse and deploy available scenarios.
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6">
          <ScrollText className="w-8 h-8 text-[var(--accent-purple)] mb-3" />
          <h3 className="font-semibold mb-1">Audit Log</h3>
          <p className="text-[var(--text-muted)] text-sm">
            Review all system actions and events.
          </p>
        </div>
      </div>
    </div>
  );
}
