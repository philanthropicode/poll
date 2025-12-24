// src/pages/AuthAction.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { auth } from "../lib/firebase";
<<<<<<< HEAD
import { useAuth } from "../context/useAuth";
=======
import { useAuth } from "../context/AuthContext";
>>>>>>> f83e35d036c58aabcd1da8d47e1d46069c6915a1

export default function AuthActionPage() {
  const [params] = useSearchParams();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");
    (async () => {
      try {
        if (mode === "verifyEmail" && oobCode) {
          await applyActionCode(auth, oobCode);
          await refreshUser();
          setStatus("ok");
          setMessage("Email verified! You can return to the app.");
        } else {
          setStatus("error");
          setMessage("Unsupported or missing action.");
        }
      } catch (e) {
        setStatus("error");
        setMessage(e.message || "Failed to complete action.");
      }
    })();
  }, []); // eslint-disable-line

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">Email Verification</h1>
      {status === "working" && <p className="text-sm">Completing action…</p>}
      {status !== "working" && (
        <>
          <div className={`rounded-xl border p-3 text-sm ${status === "ok" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            {message}
          </div>
          <Link to="/" className="inline-block rounded-xl border px-3 py-2 hover:bg-gray-50">Go to Home</Link>
        </>
      )}
    </div>
  );
}
