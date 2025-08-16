import React from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import TitleList from "../components/TitleList";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  return (
    <>
      {!user ? (
        <section className="mb-8">
          <Hero />
        </section>
      ) : (
        <section className="mb-8">
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Welcome{user?.email ? `, ${user.email}` : ""}!</h2>
            <p className="text-sm text-gray-600 mt-1">You are signed in.</p>
            <div className="mt-4">
              <Link
                to="/polls/new"
                className="inline-block rounded-xl border px-4 py-2 hover:bg-gray-50"
              >
                Create a poll
              </Link>
            </div>
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-lg font-medium">Sample Titles</h2>
        <TitleList />
      </section>
    </>
  );
}