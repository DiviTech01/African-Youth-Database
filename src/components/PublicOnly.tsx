import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Wrapper for routes that should only be visible to unauthenticated users
// (landing page, sign in, sign up). Authenticated users get bounced to their
// natural home: admins land on /admin, everyone else on /dashboard. Admins
// can flip between admin console and the user-facing site via the
// "Back to platform" / "Back to admin" buttons in DashboardLayout.
export function PublicOnly() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
}

export default PublicOnly;
