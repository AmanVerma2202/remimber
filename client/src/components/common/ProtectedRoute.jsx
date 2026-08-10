import { Navigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';

/**
 * Blocks protected pages until the user is authenticated.
 * Waits for the /auth/me check to finish first so a hard-reload or direct
 * link to /notes/:id doesn't bounce the user to login before the session loads.
 */
export default function ProtectedRoute({ children }) {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);

  if (loading) {
    return <div className="grid h-full place-items-center text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}