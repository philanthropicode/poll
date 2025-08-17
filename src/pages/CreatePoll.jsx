// src/pages/CreatePoll.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
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
  const [title, setTitle] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      console.log({
        title,
        state,
        city,
        zipcode,
        dueDate,
      });
      // Optional: basic guard in case someone hits the route directly
      if (!user) {
        throw new Error("You must be signed in to create a poll.");
      }

      // Create a new document in "polls"
      const docRef = await addDoc(collection(db, "polls"), {
        title: title.trim(),
        state: state.trim(),
        city: city.trim(),
        zipcode: zipcode.trim(),
        dueDate, // stored as YYYY-MM-DD (string) from <input type="date">
        dueAt: endOfDayUTC(dueDate),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Reset + go to the new poll
      setTitle(""); setState(""); setCity(""); setZipcode(""); setDueDate("");

      // After creating, you land on Edit; that page (see patch below) now has a View button
      navigate(`/polls/${docRef.id}/edit`);
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">Create a Poll</h2>
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
            <p className="mt-1 text-xs text-gray-600">Due: <span className="font-medium">{formatDate(dueDate)}</span></p>
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
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
