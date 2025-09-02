import React, { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import {
  collection, doc, serverTimestamp, writeBatch, increment
} from "firebase/firestore";
import { Link, useLocation } from "react-router-dom";
import { setLogLevel } from "firebase/firestore";
setLogLevel('debug');


export default function FeedbackPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("General"); // Bug | Idea | Question | Other
  const location = useLocation();
  // Try to prefill pollId if we navigated from a poll page via Header (see Header patch)
  const hintedPollId = (location.state && location.state.pollId) || null;
  const [relatedPollId, setRelatedPollId] = useState(hintedPollId || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const lastSentAtRef = useRef(0); // client-side cooldown for UX (rules still enforce)

  const maxLen = 2000;
  const minLen = 10;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSent(false);

    if (!user) {
      setError("Please sign in to send feedback.");
      return;
    }
    if (!message.trim() || message.trim().length < minLen) {
      setError(`Please write at least ${minLen} characters.`);
      return;
    }
    // Soft client-side cooldown (matches rules’ window, see below)
    const now = Date.now();
    if (now - lastSentAtRef.current < 30_000) {
      setError("Please wait a few seconds before sending more feedback.");
      return;
    }

    setSending(true);
    try {
      const batch = writeBatch(db);
      
      // feedback doc (generate an ID so we can use batch)
      const fbRef = doc(collection(db, "feedback"));
      batch.set(fbRef, {
        userId: user.uid,
        email: user.email || null,
        message: message.trim(),
        category,
        pollId: relatedPollId?.trim() || null,   // optional
        path: location.pathname,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        createdAt: serverTimestamp(),            // server timestamp
      });
      // bump rate limit doc in the SAME commit (rules will require this)
      const rateRef = doc(db, "feedback_ratelimits", user.uid);
      batch.set(rateRef, { lastAt: serverTimestamp(), count: increment(1) }, { merge: true });
      
      console.log('feedback path:', fbRef.path);
      console.log('rate path:', rateRef.path, 'uid=', user.uid);

      await batch.commit();

      lastSentAtRef.current = now;
      
      setMessage("");
      setCategory("General");
      // keep relatedPollId as-is so users can send multiple messages about the same poll

      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setError(err?.message || "Failed to send feedback");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Feedback</h1>

      {!user ? (
        <div className="rounded-2xl border p-4 text-sm">
          Please <Link to="/form" className="underline">sign in</Link> to send feedback.
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm">Category</label>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>General</option>
                <option>Bug</option>
                <option>Idea</option>
                <option>Question</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">Related poll ID (optional)</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="e.g., 9kZrP9S3wYx…"
                value={relatedPollId}
                onChange={(e) => setRelatedPollId(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">Your message</label>
            <textarea
              className="w-full min-h-[140px] rounded-xl border px-3 py-2 text-sm"
              placeholder="Tell us what’s working, what’s confusing, or what you’d like to see next…"
              maxLength={maxLen}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-600">
              {message.length}/{maxLen}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
          )}
          {sent && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-2 text-sm text-green-700">
              Thanks! Your feedback was sent.
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            {sending ? "Sending…" : "Send feedback"}
          </button>
        </form>
      )}
    </div>
  );
}
