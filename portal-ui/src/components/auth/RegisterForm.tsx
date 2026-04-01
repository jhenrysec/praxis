import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { UserPlus } from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register, error, isLoading, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    student_id: '',
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setLocalError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    try {
      const message = await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        full_name: formData.full_name,
        student_id: formData.student_id || undefined,
      });
      setSuccess(message);
    } catch {
      // Error is set in store
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-[#00e5a01a] border border-[#00e5a033] rounded-lg px-6 py-8">
          <UserPlus className="w-12 h-12 text-[var(--accent-green)] mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Registration Submitted</h2>
          <p className="text-[var(--text-secondary)] text-sm mb-6">{success}</p>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="bg-[var(--accent-green)] text-[var(--bg-base)] font-semibold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <UserPlus className="w-10 h-10 text-[var(--accent-blue)]" />
          <h1 className="text-3xl font-bold tracking-wide">REGISTER</h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Create a student account
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {displayError && (
          <div className="bg-[#fb71851a] border border-[#fb718533] rounded-lg px-4 py-3 text-[var(--accent-red)] text-sm">
            {displayError}
            <button
              type="button"
              onClick={() => { clearError(); setLocalError(null); }}
              className="float-right text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="full_name" className="label-mono text-[var(--text-secondary)] block mb-2">
              Full Name
            </label>
            <input
              id="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange('full_name')}
              required
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label htmlFor="student_id" className="label-mono text-[var(--text-secondary)] block mb-2">
              Student ID
            </label>
            <input
              id="student_id"
              type="text"
              value={formData.student_id}
              onChange={handleChange('student_id')}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label-mono text-[var(--text-secondary)] block mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            required
            autoComplete="email"
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            placeholder="you@school.edu"
          />
        </div>

        <div>
          <label htmlFor="username" className="label-mono text-[var(--text-secondary)] block mb-2">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={handleChange('username')}
            required
            minLength={3}
            autoComplete="username"
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            placeholder="jsmith"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="password" className="label-mono text-[var(--text-secondary)] block mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label-mono text-[var(--text-secondary)] block mb-2">
              Confirm
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              required
              autoComplete="new-password"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[var(--accent-blue)] text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>

      {/* Login link */}
      <div className="mt-6 text-center">
        <p className="text-[var(--text-muted)] text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-[var(--accent-green)] hover:underline"
          >
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
