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
import { getH3AggCallable } from "../lib/callables";

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
  const [debugOutput, setDebugOutput] = useState("");
  const [debugBusy, setDebugBusy] = useState(false);

  const isGlobalAdmin = !!user?.claims?.admin;

  // Debug functions
  async function testH3Agg() {
    if (!questions[0]) return;
    setDebugBusy(true);
    try {
      const { data } = await getH3AggCallable({
        pollId,
        questionId: questions[0].id,
        res: 8
      });
      setDebugOutput(JSON.stringify(data, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

  async function testH3AggWithBounds() {
    if (!questions[0]) return;
    setDebugBusy(true);
    try {
      const { data } = await getH3AggCallable({
        pollId,
        questionId: questions[0].id,
        res: 6, // Lower resolution to avoid cell limit
        west: -77.5,
        south: 38.5,
        east: -76.5,
        north: 39.5
      });
      setDebugOutput(JSON.stringify(data, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

  async function checkRawSubmissions() {
    setDebugBusy(true);
    try {
      const subQ = query(
        collection(db, "submissions"),
        where("pollId", "==", pollId)
      );
      const subSnap = await getDocs(subQ);
      const subs = [];
      subSnap.forEach((d) => {
        const data = d.data();
        if (data.questionId) { // Only question submissions, not status
          subs.push({
            id: d.id,
            questionId: data.questionId,
            value: data.value,
            city: data.city,
            state: data.state,
            zip: data.zip,
            userId: data.userId
          });
        }
      });
      setDebugOutput(JSON.stringify(subs, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

  async function checkSubmittedOnly() {
    setDebugBusy(true);
    try {
      const subQ = query(
        collection(db, "submissions"),
        where("pollId", "==", pollId),
        where("submitted", "==", true)
      );
      const subSnap = await getDocs(subQ);
      const subs = [];
      subSnap.forEach((d) => {
        const data = d.data();
        if (data.questionId) { // Only question submissions, not status
          subs.push({
            id: d.id,
            questionId: data.questionId,
            value: data.value,
            submitted: data.submitted,
            location: data.location,
            userId: data.userId
          });
        }
      });
      setDebugOutput(JSON.stringify(subs, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

  async function checkUserProfile() {
    setDebugBusy(true);
    try {
      // Check profiles for users who submitted to this poll
      const subQ = query(
        collection(db, "submissions"),
        where("pollId", "==", pollId),
        where("submitted", "==", true)
      );
      const subSnap = await getDocs(subQ);
      const userIds = new Set();
      subSnap.forEach(d => {
        const data = d.data();
        if (data.questionId && data.userId) {
          userIds.add(data.userId);
        }
      });
      
      const profiles = {};
      for (const uid of userIds) {
        try {
          const profSnap = await getDoc(doc(db, "profiles", uid));
          if (profSnap.exists()) {
            profiles[uid] = profSnap.data();
          }
        } catch (e) {}
      }
      
      setDebugOutput(JSON.stringify(profiles, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

  async function checkRollupData() {
    setDebugBusy(true);
    try {
      const results = {};
      
      // Check the actual rollup storage locations
      for (const res of [7, 8, 9]) {
        const colPath = `polls/${pollId}/h3Agg_r${res}`;
        try {
          const snap = await getDocs(collection(db, "polls", pollId, `h3Agg_r${res}`));
          const docs = [];
          snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
          if (docs.length > 0) {
            results[colPath] = docs;
          }
        } catch (e) {
          // Collection might not exist, skip
        }
      }
      
      // Also check poll meta for dirty flag
      try {
        const pollSnap = await getDoc(doc(db, "polls", pollId));
        if (pollSnap.exists()) {
          const meta = pollSnap.data()?.meta;
          if (meta) {
            results[`polls/${pollId}/meta`] = meta;
          }
        }
      } catch (e) {}
      
      setDebugOutput(JSON.stringify(results, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

  async function checkH3AggForAllQuestions() {
    setDebugBusy(true);
    try {
      const results = {};
      
      for (const q of questions) {
        try {
          const { data } = await getH3AggCallable({
            pollId,
            questionId: q.id,
            res: 8
          });
          results[q.text || q.id] = data;
        } catch (e) {
          results[q.text || q.id] = `Error: ${e.message}`;
        }
      }
      
      setDebugOutput(JSON.stringify(results, null, 2));
    } catch (e) {
      setDebugOutput(`Error: ${e.message}`);
    } finally {
      setDebugBusy(false);
    }
  }

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

      {/* Debug Panel */}
      <section className="mb-4 rounded-2xl border p-4 bg-gray-50">
        <h3 className="mb-2 font-medium">Debug Functions</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy || !questions[0]}
            onClick={testH3Agg}
          >
            Test H3 Agg (no bounds)
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy || !questions[0]}
            onClick={testH3AggWithBounds}
          >
            Test H3 Agg (MD bounds, res 6)
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy}
            onClick={checkRawSubmissions}
          >
            Check Raw Submissions
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy}
            onClick={checkRollupData}
          >
            Check Rollup Data
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy}
            onClick={checkUserProfile}
          >
            Check User Profiles
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy}
            onClick={checkSubmittedOnly}
          >
            Check Submitted=True
          </button>
          <button
            className="rounded-xl border px-3 py-1 text-sm hover:bg-white disabled:opacity-60"
            disabled={debugBusy || !questions.length}
            onClick={checkH3AggForAllQuestions}
          >
            Test All Questions
          </button>
        </div>
        {debugOutput && (
          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
            {debugOutput}
          </pre>
        )}
      </section>

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
