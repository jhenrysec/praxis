import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { useAuthStore } from '../stores/authStore';
import { Loader2 } from 'lucide-react';

export function AuthPage() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="w-8 h-8 text-[var(--accent-green)] animate-spin" />
      </div>
    );
  }

  // Already authenticated — redirect to appropriate dashboard
  if (isAuthenticated && user) {
    const target = user.role === 'student' ? '/dashboard' : '/admin';
    return <Navigate to={target} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="w-full max-w-md">
        {mode === 'login' ? (
          <LoginForm onSwitchToRegister={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setMode('login')} />
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-[var(--text-muted)] text-xs">
          Vulnerability Testing Lab — Authorized Access Only
        </div>
      </div>
    </div>
  );
}
