import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function PollViewPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const pollRef = useMemo(() => doc(db, "polls", id), [id]);
  const questionsRef = useMemo(() => collection(db, "polls", id, "questions"), [id]);

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(pollRef);
      if (snap.exists()) setPoll({ id: snap.id, ...snap.data() });
      const qsSnap = await getDocs(questionsRef);
      const items = [];
      qsSnap.forEach((d) => items.push({ id: d.id, ...(d.data() || {}) }));
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setQuestions(items);
      setLoading(false);
    })();
  }, [pollRef, questionsRef]);

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!poll)   return <div className="p-6 text-sm text-gray-600">Poll not found.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{poll.title || "Untitled Poll"}</h1>
        {user?.uid === poll.createdBy && (
          <Link to={`/polls/${id}/edit`} className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">
            Edit
          </Link>
        )}
      </div>

      {poll.description && (
        <section className="rounded-2xl border p-4">
          <h2 className="mb-2 text-lg font-medium">About</h2>
          <p className="text-sm">{poll.description}</p>
        </section>
      )}

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-medium">Questions</h2>
        <ul className="space-y-2">
          {questions.length ? questions.map((q) => (
            <li key={q.id} className="rounded-xl border p-3 text-sm">
              {q.text}
            </li>
          )) : <li className="rounded-xl border p-3 text-sm text-gray-600">No questions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
