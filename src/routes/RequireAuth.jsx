// You’re getting the sign-in prompt because the /admin route is 
// rendering before Auth has finished loading (or before your 
// ID token has the refreshed admin claim). Fix it by waiting for
// Auth to load and only then deciding whether to show the page or redirect.

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Checking your session…</div>;
  }
  if (!user) {
    // preserve where they were going
    return <Navigate to="/form" replace state={{ from: location.pathname }} />;
  }
  return children;
}
