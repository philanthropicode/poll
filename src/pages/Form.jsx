import React, { useState } from "react";

export default function FormPage() {
  const [isSignup, setIsSignup] = useState(false); // default to signin

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">
        {isSignup ? "Sign up" : "Sign in"}
      </h2>
      <form className="space-y-3">
        <div>
          <label className="mb-1 block text-sm">Email address</label>
          <input type="email" className="w-full rounded-xl border px-3 py-2" placeholder="you@example.com" />
        </div>
        <div>
          <label className="mb-1 block text-sm">Password</label>
          <input type="password" className="w-full rounded-xl border px-3 py-2" placeholder="••••••••" />
        </div>
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
                Sign in
              </a>
              <button type="submit" className="rounded-xl border px-4 py-2 hover:bg-gray-50">Sign up</button>
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
                Register
              </a>
              <button type="submit" className="rounded-xl border px-4 py-2 hover:bg-gray-50">Sign in</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}