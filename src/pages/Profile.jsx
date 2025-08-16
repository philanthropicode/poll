import React from "react";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">Your Profile</h2>
      <div className="rounded-2xl border p-4">
        {user ? (
          <>
            <p className="text-sm">Email: <span className="font-medium">{user.email}</span></p>
            <p className="text-xs text-gray-600 mt-1">UID: {user.uid}</p>
          </>
        ) : (
          <p className="text-sm text-gray-600">You are not signed in.</p>
        )}
      </div>
    </div>
  );
}
