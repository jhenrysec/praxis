import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Shield } from 'lucide-react';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { login, error, isLoading, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      // Error is set in store
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-10 h-10 text-[var(--accent-green)]" />
          <h1 className="text-3xl font-bold tracking-wide">LAB PORTAL</h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Vulnerability Testing Lab — Sign In
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-[#fb71851a] border border-[#fb718533] rounded-lg px-4 py-3 text-[var(--accent-red)] text-sm">
            {error}
            <button
              type="button"
              onClick={clearError}
              className="float-right text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div>
          <label htmlFor="email" className="label-mono text-[var(--text-secondary)] block mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] transition-colors"
            placeholder="you@lab.local"
          />
        </div>

        <div>
          <label htmlFor="password" className="label-mono text-[var(--text-secondary)] block mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[var(--accent-green)] text-[var(--bg-base)] font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Register link */}
      <div className="mt-6 text-center">
        <p className="text-[var(--text-muted)] text-sm">
          Need an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-[var(--accent-blue)] hover:underline"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}
