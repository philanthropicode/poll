// pages/AuthPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../lib/firebase";

export default function AuthPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/";

  const { signin, signup, sendVerification, currentUser, authReady } = useAuth();

  // Only decide what to do once we KNOW the auth state
  useEffect(() => {
    if (!authReady) return;
    if (currentUser) {
      navigate(redirect, { replace: true });
    }
  }, [authReady, currentUser, redirect, navigate]);

  // last-resort fallback in case the listener never fires on a rare browser:
  useEffect(() => {
    const t = setTimeout(() => {
      if (!authReady && auth.currentUser) {
        // auth.currentUser is set even if the listener missed an event
        navigate(redirect, { replace: true });
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [authReady, redirect, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setWorking(true);
    try {
      if (isSignup) {
        await signup(email, password);
        await sendVerification();
        navigate("/verify", { replace: true });
        return;
      } else {
        await signin(email, password);
        navigate(redirect, { replace: true }); // honor ?redirect=
        return;
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setWorking(false);
    }
  }

  // small loading gate so we don’t flash the form
  if (!authReady) {
    return <div className="mx-auto max-w-xl p-4 text-sm text-gray-600">Checking your session…</div>;
  }

  // If authReady && currentUser, the useEffect already navigated away.
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">{isSignup ? "Sign up" : "Sign in"}</h2>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm">Email address</label>
          <input
            type="email"
            className="w-full rounded-xl border px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm">Password</label>
          <input
            type="password"
            className="w-full rounded-xl border px-3 py-2"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}
        <div className="flex items-center gap-10">
          {isSignup ? (
            <>
              <a href="#" className="text-sm text-blue-600 hover:underline" onClick={(e) => {e.preventDefault(); setIsSignup(false);}}>
                Already have an account? Sign in
              </a>
              <button type="submit" disabled={working} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                {working ? "Creating..." : "Sign up"}
              </button>
            </>
          ) : (
            <>
              <a href="#" className="text-sm text-blue-600 hover:underline" onClick={(e) => {e.preventDefault(); setIsSignup(true);}}>
                Need an account? Sign up
              </a>
              <button type="submit" disabled={working} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                {working ? "Signing in..." : "Sign in"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
