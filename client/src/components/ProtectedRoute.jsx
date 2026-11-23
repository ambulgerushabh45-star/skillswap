// client/src/components/ProtectedRoute.jsx
// Guards routes requiring active session authentication

import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-8 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
        <span className="text-sm font-medium">Checking session...</span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}

