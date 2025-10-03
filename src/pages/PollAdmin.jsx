// src/pages/PollAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function PollAdminPage() {
  const { id: pollId } = useParams();
  const { user, loading: authLoading } = useAuth();

  const pollRef = useMemo(() => doc(db, "polls", pollId), [pollId]);
  const questionsRef = useMemo(
    () => collection(db, "polls", pollId, "questions"),
    [pollId]
  );

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]); // [{id, text, order}]
  const [rows, setRows] = useState([]); // [{ userId, values: {qid: number}, comments: {qid: string} }]
  const [totals, setTotals] = useState({}); // qid -> sum
  const [open, setOpen] = useState({}); // userId -> bool
  const [err, setErr] = useState("");

  const isGlobalAdmin = !!user?.claims?.admin;

  useEffect(() => {
    if (authLoading) return; // wait until auth is known
    (async () => {
      if (!user) {
        setErr("Please sign in.");
        setLoading(false);
        return;
      }

      // Load poll (includes createdBy and optional admins[])
      const pSnap = await getDoc(pollRef);
      if (!pSnap.exists()) {
        setErr("Poll not found.");
        setLoading(false);
        return;
      }
      const p = { id: pSnap.id, ...pSnap.data() };
      setPoll(p);

      // Check access: owner, global admin, or poll.admins includes uid
      const isOwner = user?.uid === p.createdBy;
      const inPollAdmins =
        Array.isArray(p.admins) && p.admins.includes(user?.uid);
      const allowed = isOwner || isGlobalAdmin || inPollAdmins;
      if (!allowed) {
        setErr("Access denied. You must be an admin for this poll.");
        setLoading(false);
        return;
      }

      // Load questions and sort by 'order'
      const qsSnap = await getDocs(questionsRef);
      const qs = [];
      qsSnap.forEach((d) => qs.push({ id: d.id, ...(d.data() || {}) }));
      qs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setQuestions(qs);

      // Load submissions for this poll (ignore status docs which lack questionId)
      const subQ = query(
        collection(db, "submissions"),
        where("pollId", "==", pollId)
      );
      const subSnap = await getDocs(subQ);

      // Build user -> {values, comments}
      const byUser = new Map();
      subSnap.forEach((d) => {
        const s = d.data() || {};
        if (!s.questionId) return; // skip status docs
        const u = s.userId;
        if (!u) return;

        if (!byUser.has(u))
          byUser.set(u, { userId: u, values: {}, comments: {} });
        const row = byUser.get(u);
        if (typeof s.value === "number") row.values[s.questionId] = s.value;
        if (s.comment) row.comments[s.questionId] = s.comment;
      });

      const rowsArr = Array.from(byUser.values()).sort((a, b) =>
        a.userId.localeCompare(b.userId)
      );
      setRows(rowsArr);

      // Totals per question
      const t = {};
      qs.forEach((q) => {
        t[q.id] = 0;
      });
      rowsArr.forEach((r) => {
        qs.forEach((q) => {
          t[q.id] += Number(r.values[q.id] || 0);
        });
      });
      setTotals(t);

      setLoading(false);
    })().catch((e) => {
      console.error(e);
      setErr(e.message || "Failed to load admin view");
      setLoading(false);
    });
  }, [pollRef, questionsRef, pollId, user, isGlobalAdmin, authLoading]);

  if (authLoading) {
    return (
      <div className="p-6 text-sm text-gray-600">Checking your session…</div>
    );
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;
  if (err)
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      </div>
    );
  if (!poll) return <div className="p-6 text-sm">Poll not found.</div>;

  // helpers
  const toggle = (uid) => setOpen((o) => ({ ...o, [uid]: !o[uid] }));

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Admin – {poll.title || "Untitled Poll"}
        </h1>
        <div className="flex gap-2">
          <Link
            to={`/polls/${pollId}`}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
          >
            View Poll
          </Link>
          <Link
            to={`/polls/${pollId}/edit`}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium w-[220px]">
                User
              </th>
              {questions.map((q, idx) => (
                <th key={q.id} className="px-3 py-2 text-left font-medium">
                  Q{idx + 1}
                  {q.text ? `: ${q.text}` : ""}
                </th>
              ))}
            </tr>
            {/* Totals row at the top */}
            <tr className="border-t bg-white/80">
              <th className="px-3 py-2 text-left font-semibold">Total</th>
              {questions.map((q) => (
                <th key={q.id} className="px-3 py-2 font-semibold">
                  {totals[q.id] ?? 0}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.userId}>
                {/* Numerical response row */}
                <tr className="border-t">
                  <td className="px-3 py-2 align-top">
                    <button
                      className="rounded border px-2 py-1 text-xs hover:bg-gray-50 mr-2"
                      onClick={() => toggle(r.userId)}
                    >
                      {open[r.userId] ? "Hide comments" : "Show comments"}
                    </button>
                    <span className="font-mono">{r.userId}</span>
                  </td>
                  {questions.map((q) => (
                    <td key={q.id} className="px-3 py-2 align-top">
                      {typeof r.values[q.id] === "number" ? r.values[q.id] : ""}
                    </td>
                  ))}
                </tr>
                {/* Collapsible comment row */}
                {open[r.userId] && (
                  <tr className="border-b bg-gray-50/40">
                    <td className="px-3 py-2 text-xs italic text-gray-600">
                      Comments
                    </td>
                    {questions.map((q) => (
                      <td key={q.id} className="px-3 py-2 text-xs">
                        {r.comments[q.id] ? (
                          <div className="whitespace-pre-wrap">
                            {r.comments[q.id]}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && (
              <tr className="border-t">
                <td
                  className="px-3 py-6 text-center text-gray-600"
                  colSpan={1 + questions.length}
                >
                  No responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Note: snapshot view; refresh to see new responses.
      </p>
    </div>
  );
}
