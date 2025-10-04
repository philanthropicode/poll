// src/pages/PollView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc, getDoc, collection, getDocs, setDoc, getDoc as getDocOnce, updateDoc, serverTimestamp,
  query, where
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import ShareButton from "../components/ShareButton";
import PollDescription from "../components/PollDescription";
import { exportPollCsv } from "../lib/callables";

// helpers
function formatDateStr(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString();
}
function formatWhen(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  return d ? d.toLocaleString() : "";
}

export default function PollViewPage() {
  const { id: pollId } = useParams();
  const { user } = useAuth();

  const pollRef = useMemo(() => doc(db, "polls", pollId), [pollId]);
  const questionsRef = useMemo(() => collection(db, "polls", pollId, "questions"), [pollId]);

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]); // [{id, text, order}]
  const [answers, setAnswers] = useState({});     // qid -> { value, comment?, showComment? }
  const [savingIds, setSavingIds] = useState({}); // qid -> boolean
  const [submitWorking, setSubmitWorking] = useState(false);
  const [err, setErr] = useState("");
  const [submittedAt, setSubmittedAt] = useState(null); // Timestamp | Date | null
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // export options
  const [exporting, setExporting] = useState(false);
  const [exComments, setExComments] = useState(false);
  const [exLocation, setExLocation] = useState(false);

  // profile location for stamping submissions
  const [profileLoc, setProfileLoc] = useState(null);
  const normState = (s = "") => s.trim().slice(0, 2).toUpperCase() || null;
  const normZip = (z = "") => {
    const digits = String(z).replace(/\D/g, "");
    return digits ? digits.padStart(5, "0").slice(0, 5) : null;
  };

  useEffect(() => {
    (async () => {
      if (!user) { setProfileLoc(null); return; }
      const snap = await getDoc(doc(db, "profiles", user.uid));
      const p = snap.data() || {};
      setProfileLoc({
        city: (p.city || "").trim() || null,
        state: normState(p.state || ""),
        zip: normZip(p.zip || ""),
      });
    })();
  }, [user]);

  // Keep latest answers available to handlers
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Load poll + questions; hydrate existing user submissions and status
  useEffect(() => {
    (async () => {
      const snap = await getDoc(pollRef);
      if (snap.exists()) setPoll({ id: snap.id, ...snap.data() });

      const qsSnap = await getDocs(questionsRef);
      const items = [];
      qsSnap.forEach((d) => items.push({ id: d.id, ...(d.data() || {}) }));
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setQuestions(items);

      // seed defaults
      const seed = {};
      items.forEach((q) => { seed[q.id] = { value: 0, showComment: false }; });

      if (user) {
        // hydrate answers
        const qSub = query(
          collection(db, "submissions"),
          where("pollId", "==", pollId),
          where("userId", "==", user.uid)
        );
        const subsSnap = await getDocs(qSub);
        subsSnap.forEach((d) => {
          const data = d.data() || {};
          if (!data.questionId) return; // ignore status doc
          seed[data.questionId] = {
            value: typeof data.value === "number" ? data.value : 0,
            comment: data.comment ?? "",
            showComment: !!(data.comment && String(data.comment).length > 0),
          };
        });

        // status (submittedAt + flag)
        const statusRef = doc(db, "submissions", `${pollId}__${user.uid}__status`);
        const statusSnap = await getDoc(statusRef);
        setHasSubmitted(statusSnap.exists());
        if (statusSnap.exists()) {
          const s = statusSnap.data() || {};
          if (s.submittedAt) setSubmittedAt(s.submittedAt);
        }
      } else {
        setHasSubmitted(false);
      }

      setAnswers(seed);
      setLoading(false);
    })();
  }, [pollRef, questionsRef, user, pollId]);

  async function handleExport(includeComments, includeLocation) {
    try {
      setExporting(true);
      const { data } = await exportPollCsv({ pollId, includeComments, includeLocation });
      if (data.kind === "inline") {
        const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `poll-${pollId}-export.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else if (data.kind === "url") {
        window.open(data.url, "_blank", "noopener");
      }
    } catch (e) {
      setErr(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function submissionDocIdFor(qid) {
    return `${pollId}__${user.uid}__${qid}`;
  }
  function statusDocId() {
    return `${pollId}__${user.uid}__status`;
  }

  async function persistAnswer(qid, next) {
    if (!user) {
      setErr("Please sign in to submit responses.");
      return;
    }
    setSavingIds((s) => ({ ...s, [qid]: true }));
    try {
      const loc = {};
      if (profileLoc?.city)  loc.city  = profileLoc.city;
      if (profileLoc?.state) loc.state = profileLoc.state;
      if (profileLoc?.zip)   loc.zip   = profileLoc.zip;

      const payload = {
        pollId,
        userId: user.uid,
        questionId: qid,
        value: next.value,
        updatedAt: serverTimestamp(),
        ...loc,
      };
      payload.comment =
        next.comment && next.comment.trim().length > 0 ? next.comment.trim() : null;

      await setDoc(doc(db, "submissions", submissionDocIdFor(qid)), payload, { merge: true });
    } catch (e) {
      setErr(e.message || "Failed to save response");
    } finally {
      setSavingIds((s) => ({ ...s, [qid]: false }));
    }
  }

  // Slider: update UI only; save on release & on exit/submit
  function handleSlider(qid, value) {
    const v = Number(value);
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], value: v } }));
  }
  function saveOneFromState(qid) {
    const latest = answersRef.current[qid];
    if (latest) persistAnswer(qid, latest);
  }
  function saveAllFromState() {
    const a = answersRef.current || {};
    Object.keys(a).forEach((qid) => persistAnswer(qid, a[qid]));
  }

  // Save in-memory changes on route exit
  useEffect(() => () => { saveAllFromState(); }, []);

  // Comment helpers
  function addComment(qid) {
    setAnswers((prev) => ({
      ...prev,
      [qid]: { ...prev[qid], showComment: true, comment: prev[qid]?.comment ?? "" },
    }));
  }
  function removeComment(qid) {
    setAnswers((prev) => {
      const next = { ...prev[qid], showComment: false, comment: "" };
      persistAnswer(qid, next);
      return { ...prev, [qid]: next };
    });
  }
  function changeComment(qid, text) {
    setAnswers((prev) => {
      const next = { ...prev[qid], comment: text };
      return { ...prev, [qid]: next };
    });
  }
  async function blurComment(qid) {
    await persistAnswer(qid, answersRef.current[qid]);
  }

  // Submit: save all latest first, then write status doc
  async function submitAll() {
    if (!user) {
      setErr("Please sign in to submit.");
      return;
    }
    setErr(""); setSubmitWorking(true);
    try {
      const qids = Object.keys(answersRef.current || {});
      await Promise.all(qids.map((qid) => persistAnswer(qid, answersRef.current[qid])));

      const statusRef = doc(db, "submissions", statusDocId());
      const existing = await getDocOnce(statusRef);
      if (existing.exists()) {
        await updateDoc(statusRef, { submittedAt: serverTimestamp() });
      } else {
        await setDoc(statusRef, {
          pollId,
          userId: user.uid,
          createdAt: serverTimestamp(),
          submittedAt: serverTimestamp(),
        });
      }
      setSubmittedAt(new Date()); // reflect immediately
    } catch (e) {
      setErr(e.message || "Failed to submit");
    } finally {
      setSubmitWorking(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!poll)   return <div className="p-6 text-sm text-gray-600">Poll not found.</div>;

  const isOwner = user?.uid === poll.createdBy;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Title + Due + Submitted + Share/Edit */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{poll.title || "Untitled Poll"}</h1>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border px-3 py-2 text-sm">
            {poll?.dueDate
              ? <>Due date: <span className="font-medium">{formatDateStr(poll.dueDate)}</span></>
              : <span className="text-gray-600">No due date set</span>}
          </div>
          {submittedAt && (
            <div className="rounded-xl border px-3 py-2 text-sm">
              Submitted on: <span className="font-medium">{formatWhen(submittedAt)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ShareButton pollId={pollId} />
          {isOwner && (
            <Link to={`/polls/${pollId}/edit`} className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Export (visible to signed-in users who submitted) */}
      {user && hasSubmitted && (
        <section className="rounded-2xl border p-4">
          <h3 className="mb-2 font-medium">Export</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>CSV options:</span>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={exComments} onChange={(e) => setExComments(e.target.checked)} />
              Include comments
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={exLocation} onChange={(e) => setExLocation(e.target.checked)} />
              Include city/state/ZIP
            </label>
            <button
              className="rounded-xl border px-3 py-1 hover:bg-gray-50"
              disabled={exporting}
              onClick={() => handleExport(exComments, exLocation)}
            >
              {exporting ? "Preparing…" : "Export results (CSV)"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            User IDs are never included. Large exports may open as a temporary download link.
          </p>
        </section>
      )}

      {/* Description */}
      {poll.description && (
        <section className="rounded-2xl border p-4">
          <h2 className="mb-2 text-lg font-medium">About</h2>
          <PollDescription description={poll.description} />
        </section>
      )}

      {/* Questions with sliders + comments */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-medium">Questions</h2>
        {!user && (
          <div className="mb-3 rounded-xl border p-3 text-sm">
            Please <Link to="/auth" className="underline">sign in</Link> to answer.
          </div>
        )}
        <ul className="space-y-4">
          {questions.map((q) => {
            const a = answers[q.id] ?? { value: 0, showComment: false, comment: "" };
            return (
              <li key={q.id} className="rounded-xl border p-3">
                <p className="text-sm mb-2">{q.text}</p>

                {/* Slider: -10 .. 10, default 0 */}
                <div className="flex items-center gap-3">
                  <span className="text-xs w-6 text-right">-10</span>
                  <input
                    type="range"
                    min="-10" max="10" step="1"
                    value={a.value}
                    disabled={!user}
                    onChange={(e) => handleSlider(q.id, e.target.value)}
                    onMouseUp={() => saveOneFromState(q.id)}
                    onTouchEnd={() => saveOneFromState(q.id)}
                    className="flex-1"
                  />
                  <span className="text-xs w-6">10</span>
                  <span className="text-xs w-8 text-right">{a.value}</span>
                  {savingIds[q.id] && <span className="text-[10px] opacity-60">saving…</span>}
                </div>

                {/* Comment link / box */}
                <div className="mt-2">
                  {!a.showComment ? (
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); addComment(q.id); }}
                      className={`text-sm ${user ? "text-blue-600 hover:underline" : "opacity-50 pointer-events-none"}`}
                    >
                      Add a comment
                    </a>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="Write a short comment…"
                        value={a.comment ?? ""}
                        disabled={!user}
                        onChange={(e) => changeComment(q.id, e.target.value)}
                        onBlur={() => blurComment(q.id)}
                      />
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        disabled={!user}
                        onClick={() => removeComment(q.id)}
                      >
                        Remove comment
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {questions.length === 0 && (
            <li className="rounded-xl border p-3 text-sm text-gray-600">No questions yet.</li>
          )}
        </ul>
      </section>

      {/* Submit whole poll */}
      <div className="flex justify-end">
        <button
          disabled={!user || submitWorking || questions.length === 0}
          onClick={submitAll}
          className="rounded-xl border px-4 py-2 hover:bg-gray-50"
        >
          {submitWorking ? "Submitting…" : "Submit"}
        </button>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
    </div>
  );
}
