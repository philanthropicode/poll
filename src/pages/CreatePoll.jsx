// src/pages/CreatePoll.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  addDoc, collection, serverTimestamp, Timestamp,
  writeBatch, doc, getDocs
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

function formatDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString();
}
function endOfDayUTC(dateStr /* 'YYYY-MM-DD' */) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)));
}

export default function CreatePollPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // If navigated here via "Copy", we’ll have these:
  const mode = location.state?.mode || "new";
  const sourcePollId = location.state?.sourcePollId || null;
  const prefill = useMemo(() => location.state?.prefill || {}, [location.state]);

  const [title, setTitle] = useState(prefill.title || "");
  const [description, setDescription] = useState(prefill.description || "");
  const [state, setState] = useState(prefill.state || "");
  const [city, setCity] = useState(prefill.city || "");
  const [zipcode, setZipcode] = useState(prefill.zipcode || "");
  const [dueDate, setDueDate] = useState(prefill.dueDate || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // (Optional) if you want to warn when not signed in
  useEffect(() => {
    if (!user) {
      // no-op; you could redirect to /auth with state=returnTo if you prefer
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (!user) throw new Error("You must be signed in to create a poll.");

      // 1) Create the poll (with description!)
      const newPollRef = await addDoc(collection(db, "polls"), {
        title: title.trim(),
        description: description.trim(),          // ✅ now included
        state: state.trim(),
        city: city.trim(),
        zipcode: zipcode.trim(),
        dueDate,                                  // 'YYYY-MM-DD'
        dueAt: endOfDayUTC(dueDate),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // 2) If we’re copying, clone questions from the source poll
      if (mode === "copy" && sourcePollId) {
        const srcQsSnap = await getDocs(collection(db, "polls", sourcePollId, "questions"));
        if (!srcQsSnap.empty) {
          const batch = writeBatch(db);
          srcQsSnap.forEach((d) => {
            const q = d.data() || {};
            const dest = doc(collection(db, "polls", newPollRef.id, "questions"));
            batch.set(dest, {
              text: q.text || "",
              order: typeof q.order === "number" ? q.order : 0,
              createdAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
      }

      // 3) Navigate to edit the fresh poll
      navigate(`/polls/${newPollRef.id}/edit`);
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">
        {mode === "copy" ? "Copy Poll" : "Create a Poll"}
      </h2>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm">Poll title</label>
          <input
            type="text"
            className="w-full rounded-xl border px-3 py-2"
            placeholder="e.g., Neighborhood Transit Priorities"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* ✅ Description at creation time (optional) */}
        <div>
          <label className="mb-1 block text-sm">Description (optional)</label>
          <textarea
            className="w-full min-h-[120px] rounded-xl border px-3 py-2"
            placeholder="Write a short description… (you can edit later)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">State</label>
          <input
            type="text"
            className="w-full rounded-xl border px-3 py-2"
            placeholder="e.g., MD"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">City</label>
          <input
            type="text"
            className="w-full rounded-xl border px-3 py-2"
            placeholder="e.g., Baltimore"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Zip code</label>
          <input
            type="text"
            className="w-full rounded-xl border px-3 py-2"
            placeholder="e.g., 21201"
            inputMode="numeric"
            pattern="\d{5}"
            title="5-digit ZIP code"
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Due date</label>
          <input
            type="date"
            className="w-full rounded-xl border px-3 py-2"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          {dueDate && (
            <p className="mt-1 text-xs text-gray-600">
              Due: <span className="font-medium">{formatDate(dueDate)}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            {submitting ? "Submitting..." : (mode === "copy" ? "Create Copy" : "Create")}
          </button>
        </div>
      </form>
    </div>
  );
}
