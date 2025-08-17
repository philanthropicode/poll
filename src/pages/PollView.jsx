import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc, getDoc, collection, getDocs, setDoc, getDoc as getDocOnce, updateDoc, serverTimestamp, query, where
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function PollViewPage() {
  const { id: pollId } = useParams();
  const { user } = useAuth();

  const pollRef = useMemo(() => doc(db, "polls", pollId), [pollId]);
  const questionsRef = useMemo(() => collection(db, "polls", pollId, "questions"), [pollId]);

  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]); // [{id, text, order}]
  const [answers, setAnswers] = useState({});     // qid -> { value: number, comment?: string, showComment?: bool }
  const [savingIds, setSavingIds] = useState({}); // qid -> boolean
  const [submitWorking, setSubmitWorking] = useState(false);
  const [err, setErr] = useState("");

  // Load poll and questions, seed default answers, then hydrate from submissions if logged in
  useEffect(() => {
    (async () => {
      const snap = await getDoc(pollRef);
      if (snap.exists()) {
        setPoll({ id: snap.id, ...snap.data() });
      }
      const qsSnap = await getDocs(questionsRef);
      const items = [];
      qsSnap.forEach((d) => items.push({ id: d.id, ...(d.data() || {}) }));
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setQuestions(items);

      // initialize sliders to 0 (center)
      const seed = {};
      items.forEach((q) => { seed[q.id] = { value: 0, showComment: false }; });
      setAnswers(seed);

      // If logged in, fetch existing submissions for this poll/user and hydrate
      if (user) {
        const qSub = query(
          collection(db, "submissions"),
          where("pollId", "==", pollId),
          where("userId", "==", user.uid)
        );
        const subsSnap = await getDocs(qSub);
        const hydrated = { ...seed };
        subsSnap.forEach((d) => {
          const data = d.data() || {};
          if (!data.questionId) return; // ignore status doc
          hydrated[data.questionId] = {
            value: typeof data.value === "number" ? data.value : 0,
            comment: data.comment ?? "",
            showComment: !!(data.comment && String(data.comment).length > 0),
          };
        });
        setAnswers(hydrated);
      }

      setLoading(false);
    })();
  }, [pollRef, questionsRef, user, pollId]);

  function submissionDocIdFor(qid) {
    // deterministic per-question doc so updates overwrite
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
      const payload = {
        pollId,
        userId: user.uid,
        questionId: qid,
        value: next.value,
        updatedAt: serverTimestamp(),
      };
      if (next.comment && next.comment.trim().length > 0) {
        payload.comment = next.comment.trim();
      } else {
        // Ensure comment is removed if cleared
        payload.comment = null;
      }
      await setDoc(doc(db, "submissions", submissionDocIdFor(qid)), payload, { merge: true });
    } catch (e) {
      setErr(e.message || "Failed to save response");
    } finally {
      setSavingIds((s) => ({ ...s, [qid]: false }));
    }
  }

  async function handleSlider(qid, value) {
    const v = Number(value);
    setAnswers((prev) => {
      const next = { ...prev[qid], value: v };
      // fire-and-forget save
      persistAnswer(qid, next);
      return { ...prev, [qid]: next };
    });
  }

  function addComment(qid) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], showComment: true, comment: prev[qid]?.comment ?? "" } }));
  }
  function removeComment(qid) {
    setAnswers((prev) => {
      const next = { ...prev[qid], showComment: false, comment: "" };
      // also clear in Firestore
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
    // save comment on blur
    await persistAnswer(qid, answers[qid]);
  }

  async function submitAll() {
    if (!user) {
      setErr("Please sign in to submit.");
      return;
    }
    setErr(""); setSubmitWorking(true);
    try {
      // Create or update a status document marking the submission completed
      console.log("Create or update a status document marking the submission completed");
      const statusRef = doc(db, "submissions", statusDocId());
      console.log("Status document ref:", statusRef.path);
      const existing = await getDocOnce(statusRef);
      console.log("Existing status document:", existing.exists());
      if (existing.exists()) {
        console.log("Updating existing status document");
        await updateDoc(statusRef, { submittedAt: serverTimestamp() });
      } else {
        console.log("Creating new status document");
        await setDoc(statusRef, {
          pollId,
          userId: user.uid,
          createdAt: serverTimestamp(),
          submittedAt: serverTimestamp(),
        });
      }
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
      {/* Title + Edit if creator */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{poll.title || "Untitled Poll"}</h1>
        {isOwner && (
          <Link to={`/polls/${pollId}/edit`} className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">
            Edit
          </Link>
        )}
      </div>

      {/* Description */}
      {poll.description && (
        <section className="rounded-2xl border p-4">
          <h2 className="mb-2 text-lg font-medium">About</h2>
          <p className="text-sm">{poll.description}</p>
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
