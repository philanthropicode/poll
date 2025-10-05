// You’re getting the sign-in prompt because the /admin route is 
// rendering before Auth has finished loading (or before your 
// ID token has the refreshed admin claim). Fix it by waiting for
// Auth to load and only then deciding whether to show the page or redirect.

// routes/RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const { currentUser, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) return <div className="p-4 text-sm text-gray-600">Checking your session…</div>;

  if (!currentUser) {
    const redirect = `${location.pathname}${location.search || ""}`;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return children;
}
