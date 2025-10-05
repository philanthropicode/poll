// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getIdTokenResult,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const triedForceRefreshRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setUser(null);
          setAuthReady(true);
          setLoading(false);
          return;
        }

        // Get claims (admin, etc.)
        let t = await getIdTokenResult(u);

        // If admin claim not present yet, force a one-time refresh
        if (!t.claims?.admin && !triedForceRefreshRef.current) {
          triedForceRefreshRef.current = true;
          try {
            await u.getIdToken(true);
            t = await getIdTokenResult(u);
          } catch {
            /* ignore */
          }
        }

        setUser({ ...u, claims: t.claims });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Auth helpers
  const signin = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const signup = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const signout = () => signOut(auth);

  // Force ID token refresh to pull updated custom claims
  const refreshClaims = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.getIdToken(true);
    const t = await getIdTokenResult(auth.currentUser);
    setUser({ ...auth.currentUser, claims: t.claims });
  };

  // Send the verification email
  const sendVerification = async () => {
    if (!auth.currentUser) throw new Error("Not signed in.");
    const actionCodeSettings = {
      // This route will handle the verification link
      // After clicking the email link, Firebase verifies on its page and then redirects here:
      url: `${window.location.origin}/verify`,
      handleCodeInApp: false,
    };
    await sendEmailVerification(auth.currentUser, actionCodeSettings);
  };

  // Reload the Firebase user object so emailVerified updates after clicking the link
  const refreshUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    // Pick up latest claims as well (optional)
    const t = await getIdTokenResult(auth.currentUser);
    setUser({ ...auth.currentUser, claims: t.claims });
  };

  const value = {
    user,
    authReady,
    loading,
    signin,
    signup,
    signout,
    refreshClaims,
    sendVerification,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
