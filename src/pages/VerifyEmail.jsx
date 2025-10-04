// src/pages/VerifyEmail.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailPage() {
  const { user, sendVerification, refreshUser } = useAuth();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <h1 className="text-xl font-semibold">Verify your email</h1>
        <p className="text-sm">Please <Link to="/form" className="underline">sign in</Link> first.</p>
      </div>
    );
  }

  async function handleResend() {
    setMsg(""); setErr(""); setBusy(true);
    try {
      await sendVerification();
      setMsg("Verification email sent. Check your inbox (and spam).");
    } catch (e) {
      setErr(e.message || "Failed to send verification email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setMsg(""); setErr(""); setBusy(true);
    try {
      await refreshUser();
      if (user.emailVerified) setMsg("Email verified! You’re all set.");
      else setMsg("Not verified yet. Click the link in your email, then Refresh.");
    } catch (e) {
      setErr(e.message || "Failed to refresh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">Verify your email</h1>
      <p className="text-sm">Signed in as <span className="font-medium">{user.email}</span></p>

      {user.emailVerified ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm">Your email is verified.</div>
      ) : (
        <div className="rounded-2xl border p-3 text-sm">
          <p className="mb-2">We sent a verification link to your email. Click it, then press “Refresh status”.</p>
          <div className="flex gap-2">
            <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" disabled={busy} onClick={handleResend}>
              Resend email
            </button>
            <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" disabled={busy} onClick={handleRefresh}>
              Refresh status
            </button>
            <Link to="/" className="rounded-xl border px-3 py-2 hover:bg-gray-50">Go Home</Link>
          </div>
        </div>
      )}

      {msg && <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
    </div>
  );
}
