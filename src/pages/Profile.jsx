import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

function normalizeState(s = "") {
  return s.trim().slice(0, 2).toUpperCase();
}
function normalizeZip(z = "") {
  const digits = String(z).replace(/\D/g, "");
  return digits.padStart(5, "0").slice(0, 5);
}

export default function ProfilePage() {
  const { user, sendVerification, refreshUser } = useAuth();

  // address/profile fields
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateAbbr, setStateAbbr] = useState("");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  // verification UI
  const [vBusy, setVBusy] = useState(false);
  const [vMsg, setVMsg] = useState("");
  const [vErr, setVErr] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, "profiles", user.uid));
        if (snap.exists() && !ignore) {
          const p = snap.data() || {};
          const addr = p.address || p; // backward compat with your existing fields
          setLine1(addr.line1 || "");
          setLine2(addr.line2 || "");
          setCity(addr.city || "");
          setStateAbbr(addr.state || "");
          setZip(addr.zip || "");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    if (!user) return;
    setErr(""); setSaved(false); setSaving(true);
    try {
      const functions = getFunctions();
      const saveUserAddress = httpsCallable(functions, "saveUserAddress");

      const payload = {
        line1: line1.trim(),
        line2: line2.trim(),
        city: city.trim(),
        state: normalizeState(stateAbbr),
        zip: normalizeZip(zip),
      };

      const res = await saveUserAddress(payload);
      if (res?.data?.ok) setSaved(true);
    } catch (e) {
      setErr(e.message || "Failed to save address");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleResend() {
    setVBusy(true); setVMsg(""); setVErr("");
    try {
      await sendVerification();
      setVMsg("Verification email sent. Check your inbox (and spam).");
    } catch (e) {
      setVErr(e.message || "Failed to send verification email.");
    } finally {
      setVBusy(false);
    }
  }

  async function handleRefresh() {
    setVBusy(true); setVMsg(""); setVErr("");
    try {
      await refreshUser();
      setVMsg(user?.emailVerified
        ? "Your email is verified."
        : "Still not verified. Click the link in your email, then press Refresh.");
    } catch (e) {
      setVErr(e.message || "Failed to refresh status.");
    } finally {
      setVBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">Your Profile</h2>

      <div className="rounded-2xl border p-4">
        {!user ? (
          <p className="text-sm text-gray-600">You are not signed in.</p>
        ) : loading ? (
          <p className="text-sm text-gray-600">Loading…</p>
        ) : (
          <>
            {/* Email + verification status */}
            <div className="mb-3 space-y-1">
              <p className="text-sm">
                Email: <span className="font-medium">{user.email}</span>
              </p>
              <p className="text-sm">
                Status:{" "}
                <span className={user.emailVerified ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                  {user.emailVerified ? "Verified" : "Not verified"}
                </span>
              </p>

              {!user.emailVerified && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={handleResend} disabled={vBusy}>
                    Resend verification email
                  </button>
                  <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={handleRefresh} disabled={vBusy}>
                    Refresh status
                  </button>
                </div>
              )}

              {vMsg && <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800">{vMsg}</div>}
              {vErr && <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{vErr}</div>}
            </div>

            {/* Address form */}
            <form className="space-y-3" onSubmit={handleSave}>
              <div>
                <label className="mb-1 block text-sm">Street address</label>
                <input className="w-full rounded-xl border px-3 py-2" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="e.g., 1600 Pennsylvania Ave NW" />
              </div>
              <div>
                <label className="mb-1 block text-sm">Apt/Suite (optional)</label>
                <input className="w-full rounded-xl border px-3 py-2" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="e.g., Apt 2B" />
              </div>
              <div>
                <label className="mb-1 block text-sm">City</label>
                <input className="w-full rounded-xl border px-3 py-2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Austin" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">State (2-letter)</label>
                  <input className="w-full rounded-xl border px-3 py-2" value={stateAbbr} onChange={(e) => setStateAbbr(e.target.value)} placeholder="e.g., TX" maxLength={2} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">ZIP code</label>
                  <input className="w-full rounded-xl border px-3 py-2" value={zip} inputMode="numeric" onChange={(e) => setZip(e.target.value)} placeholder="e.g., 73301" />
                </div>
              </div>

              {err && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                  {saving ? "Saving…" : "Save Address"}
                </button>
                {saved && <span className="text-xs text-green-700">Saved</span>}
              </div>
            </form>

            <p className="text-xs text-gray-600 mt-3">UID: {user.uid}</p>
          </>
        )}
      </div>
    </div>
  );
}
