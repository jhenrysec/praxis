import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Users, Server, BookOpen, ScrollText } from 'lucide-react';

export function AdminDashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const cards = [
    {
      to: '/admin/users',
      icon: <Users className="w-8 h-8 text-[var(--accent-blue)] mb-3" />,
      title: 'Users',
      description: 'Manage students, approvals, and slot assignments.',
      show: true,
    },
    {
      to: '/admin/slots',
      icon: <Server className="w-8 h-8 text-[var(--accent-green)] mb-3" />,
      title: 'Lab Slots',
      description: 'Deploy, destroy, and monitor 20 lab slots.',
      show: true,
    },
    {
      to: '/scenarios',
      icon: <BookOpen className="w-8 h-8 text-[var(--accent-amber)] mb-3" />,
      title: 'Scenarios',
      description: 'Browse and deploy available scenarios.',
      show: true,
    },
    {
      to: '/admin/audit',
      icon: <ScrollText className="w-8 h-8 text-[var(--accent-purple)] mb-3" />,
      title: 'Audit Log',
      description: 'Review all system actions and events.',
      show: isAdmin,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-wide mb-2">
        Instructor Dashboard
      </h1>
      <p className="text-[var(--text-secondary)] text-sm mb-8">
        Welcome, {user?.full_name} — {user?.role}
      </p>

      <div className="grid grid-cols-4 gap-6">
        {cards.filter((c) => c.show).map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="block bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 hover:border-[var(--border-active)] hover:bg-[var(--bg-surface-hover,var(--bg-surface))] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
          >
            {c.icon}
            <h3 className="font-semibold mb-1">{c.title}</h3>
            <p className="text-[var(--text-muted)] text-sm">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
