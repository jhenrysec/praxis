import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { AuthPage } from './pages/AuthPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserManagement } from './pages/UserManagement';
import { SlotManagement } from './pages/SlotManagement';
import { ScenarioBrowser } from './pages/ScenarioBrowser';
import { AuditLog } from './pages/AuditLog';
import { ConsolePage } from './pages/ConsolePage';
import { BlueTeamSoc } from './pages/BlueTeamSoc';
import { AppLayout } from './components/shared/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

export function App() {
  const { restoreSession, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Default redirect based on role
  const defaultPath = !isAuthenticated
    ? '/login'
    : user?.role === 'student'
      ? '/dashboard'
      : '/admin';

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<AuthPage />} />

      {/* Protected — wrapped in layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Student routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Instructor/Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'instructor']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Instructor/Admin management pages */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin', 'instructor']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/slots"
          element={
            <ProtectedRoute allowedRoles={['admin', 'instructor']}>
              <SlotManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />

        {/* Shared pages */}
        <Route path="/scenarios" element={<ScenarioBrowser />} />
        <Route path="/console" element={<ConsolePage />} />
        <Route
          path="/soc"
          element={
            <ProtectedRoute allowedRoles={['admin', 'instructor']}>
              <BlueTeamSoc />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  );
}
