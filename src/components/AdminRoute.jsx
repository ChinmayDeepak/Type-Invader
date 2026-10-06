import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Client-side gate only - it hides the UI. The real check is
 * the Supabase database function, which checks the stored ADMIN role.
 */
export default function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="loading">checking session…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
