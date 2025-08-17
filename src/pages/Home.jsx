// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero";
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
  if (d?.toDate) return d.toDate().toLocaleDateString(); // Firestore Timestamp
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
            dueDate: data.dueDate || null, // string "YYYY-MM-DD" per CreatePoll
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
        <section className="mb-8">
          <Hero />
        </section>
      ) : (
        <section className="mb-8">
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">
              Welcome{user?.email ? `, ${user.email}` : ""}!
            </h2>
            <p className="text-sm text-gray-600 mt-1">You are signed in.</p>
            <div className="mt-4">
              <Link to="/polls/new" className="inline-block rounded-xl border px-4 py-2 hover:bg-gray-50">
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
    </>
  );
}
