// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

function formatDateStr(d) {
  if (!d) return "—";
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    return isNaN(dt) ? d : dt.toLocaleDateString();
  }
  if (d?.toDate) return d.toDate().toLocaleDateString();
  if (d instanceof Date) return d.toLocaleDateString();
  return "—";
}

export default function Home() {
  const { user, loading } = useAuth();
  const [polls, setPolls] = useState([]);
  const [pollsLoading, setPollsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"), limit(10));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((doc) => {
          const data = doc.data() || {};
          rows.push({
            id: doc.id,
            title: data.title || "Untitled",
            dueDate: data.dueDate || null,
          });
        });
        setPolls(rows);
        setPollsLoading(false);
      },
      () => setPollsLoading(false)
    );
    return () => unsub();
  }, []);

  return (
    <>
      {/* Logged-out hero or welcome when signed in */}
      {loading ? (
        <div className="p-6 text-sm text-gray-600">Loading...</div>
      ) : !user ? (
        <section className="relative mb-8">
          {/* Background accent */}
          <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
            <div className="h-full w-full bg-gradient-to-b from-blue-50 via-indigo-50 to-white" />
            <svg
              aria-hidden="true"
              className="absolute left-1/2 top-0 -translate-x-1/2 opacity-20"
              width="1200"
              height="240"
              viewBox="0 0 1200 240"
              fill="none"
            >
              <defs>
                <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill="#c7d2fe" />
                </pattern>
              </defs>
              <rect width="1200" height="240" fill="url(#dots)" />
            </svg>
            <div className="absolute -top-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-blue-200 blur-3xl opacity-30" />
          </div>

          {/* Hero content */}
          <div className="mx-auto max-w-3xl text-center px-4 py-12 sm:py-16 space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold sm:text-4xl">
                Turning <span className="text-blue-700">common ground</span> into action
              </h1>
              <p className="text-lg text-gray-700">
                Philanthropicode helps communities, organizations, and institutions move{" "}
                <strong>from division to direction</strong> — revealing shared priorities and
                turning agreement into measurable progress.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <a
                href="/signup"
                className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create a Space
              </a>
              <a
                href="/pricing"
                className="inline-block rounded-lg border px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Explore Plans
              </a>
            </div>

            {/* Credibility chips */}
            <div className="pt-4 space-y-3">
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Built by civic technologists",
                  "Transparent by design",
                  "Organization & public polls",
                  "Location-based eligibility",
                ].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border px-3 py-1 text-xs text-gray-600 bg-white/60 backdrop-blur-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-500">Progress, even when we disagree.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-8">
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">
              Welcome{user?.email ? `, ${user.email}` : ""}!
            </h2>
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

      {/* Recent polls list */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Recent Polls</h2>
          {user && (
            <Link to="/polls/new" className="text-sm underline">
              New poll
            </Link>
          )}
        </div>
        <div className="mt-3 rounded-2xl border overflow-hidden">
          <ul>
            {pollsLoading ? (
              <li className="p-3 text-sm text-gray-600">Loading…</li>
            ) : polls.length === 0 ? (
              <li className="p-3 text-sm text-gray-600">No polls yet.</li>
            ) : (
              polls.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between border-b last:border-b-0 p-3"
                >
                  <Link to={`/polls/${p.id}`} className="hover:underline">
                    {p.title}
                  </Link>
                  <span className="text-sm text-gray-600">{formatDateStr(p.dueDate)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Footer CTA strip */}
      <section className="border-t mt-12 bg-blue-50 py-8">
        <div className="mx-auto max-w-3xl text-center px-4 space-y-3">
          <h2 className="text-lg font-semibold">Ready to shape your community’s future?</h2>
          <p className="text-gray-700 text-sm">
            Create your organization’s space and start turning shared values into shared
            action.
          </p>
          <a
            href="/signup"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create a Space
          </a>
        </div>
      </section>
    </>
  );
}
