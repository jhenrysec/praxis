import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  Shield,
  LayoutDashboard,
  Users,
  Server,
  BookOpen,
  LogOut,
  Terminal,
  Settings,
  ScrollText,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Array<'admin' | 'instructor' | 'student'>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['student'] },
  { label: 'Admin', path: '/admin', icon: <Settings className="w-5 h-5" />, roles: ['admin', 'instructor'] },
  { label: 'Users', path: '/admin/users', icon: <Users className="w-5 h-5" />, roles: ['admin', 'instructor'] },
  { label: 'Lab Slots', path: '/admin/slots', icon: <Server className="w-5 h-5" />, roles: ['admin', 'instructor'] },
  { label: 'Audit Log', path: '/admin/audit', icon: <ScrollText className="w-5 h-5" />, roles: ['admin'] },
  { label: 'Scenarios', path: '/scenarios', icon: <BookOpen className="w-5 h-5" />, roles: ['admin', 'instructor', 'student'] },
  { label: 'Console', path: '/console', icon: <Terminal className="w-5 h-5" />, roles: ['admin', 'instructor', 'student'] },
];

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  );

  return (
    <div className="h-screen flex bg-[var(--bg-base)]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[var(--accent-green)]" />
            <span className="text-lg font-bold tracking-wider">LAB PORTAL</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard' || item.path === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--accent-green)] bg-opacity-10 text-[var(--accent-green)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-[var(--border-default)]">
          <div className="px-3 mb-3">
            <p className="text-sm text-[var(--text-primary)] truncate">{user?.full_name}</p>
            <p className="label-mono text-[var(--text-muted)] mt-0.5">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-hover)] w-full transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
