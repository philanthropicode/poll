import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function FormPage() {
  const [isSignup, setIsSignup] = useState(false); // default to signin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();
  const { signin, signup } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setWorking(true);
    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await signin(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setWorking(false);
    }
  }

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
        <div className="flex items-center justify-between">
          {isSignup ? (
            <>
              <a
                href="#"
                className="text-sm text-blue-600 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSignup(false);
                }}
              >
                Already have an account? Sign in
              </a>
              <button type="submit" disabled={working} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                {working ? "Creating..." : "Sign up"}
              </button>
            </>
          ) : (
            <>
              <a
                href="#"
                className="text-sm text-blue-600 hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSignup(true);
                }}
              >
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