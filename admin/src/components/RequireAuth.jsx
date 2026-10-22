import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap any route element that should require a signed-in admin/staff
 * session. Access is decided ONLY by `isAuthenticated`, which
 * AuthContext sets ONLY after a token is verified against the backend
 * (/api/auth/me on load, or a successful /api/auth/login). Nothing
 * client-controlled — no toggle, no query param, no local state —
 * can flip this.
 */
export default function RequireAuth({ children, roles }) {
  const { isAuthenticated, admin, loading } = useAuth();
  const location = useLocation();

  // Still verifying a stored token against the backend — render nothing
  // rather than redirecting prematurely, or a valid session gets
  // flash-bounced to /admin/login before rehydration finishes.
  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Optional per-route role gate, e.g. <RequireAuth roles={["super_admin"]}>
  // Mirrors the backend's requireRole — this is a UX nicety only, the
  // real enforcement is server-side on each endpoint.
  if (roles && !roles.includes(admin?.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}