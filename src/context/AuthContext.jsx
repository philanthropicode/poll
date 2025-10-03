import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getIdTokenResult,
} from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const triedForceRefreshRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      // Read claims
      let t = await getIdTokenResult(u);
      // If we don't see admin yet, force one refresh once
      if (!t.claims?.admin && !triedForceRefreshRef.current) {
        triedForceRefreshRef.current = true;
        try {
          await u.getIdToken(true); // force refresh
          t = await getIdTokenResult(u); // re-read claims
        } catch {}
      }
      setUser({ ...u, claims: t.claims });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signin = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);
  const signup = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);
  const signout = () => signOut(auth);
  const refreshClaims = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.getIdToken(true);
    const t = await getIdTokenResult(auth.currentUser);
    setUser({ ...auth.currentUser, claims: t.claims });
  };

  const value = { user, loading, signin, signup, signout, refreshClaims };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
