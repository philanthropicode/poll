import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc, getDoc, updateDoc,
  collection, addDoc, onSnapshot, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function PollEditPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const pollRef = useMemo(() => doc(db, "polls", id), [id]);
  const questionsRef = useMemo(() => collection(db, "polls", id, "questions"), [id]);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [questions, setQuestions] = useState([]); // [{id, text, order}]
  const [newQ, setNewQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    let unsubQ = () => {};
    (async () => {
      const snap = await getDoc(pollRef);
      if (snap.exists()) {
        const data = snap.data();
        setTitle(data.title || "");
        setDescription(data.description || "");
      }
      setLoading(false);
      unsubQ = onSnapshot(questionsRef, (qs) => {
        const items = [];
        qs.forEach((d) => items.push({ id: d.id, ...(d.data() || {}) }));
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setQuestions(items);
      });
    })();
    return () => unsubQ();
  }, [pollRef, questionsRef]);

  async function handleSaveDescription(e) {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      if (!user) throw new Error("You must be signed in.");
      await updateDoc(pollRef, { description });
    } catch (e) {
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddQuestion(e) {
    e.preventDefault();
    if (!newQ.trim()) return;
    setErr("");
    try {
      if (!user) throw new Error("You must be signed in.");
      await addDoc(questionsRef, {
        text: newQ.trim(),
        createdAt: serverTimestamp(),
        order: questions.length,
      });
      setNewQ("");
    } catch (e) {
      setErr(e.message || "Failed to add question");
    }
  }

  async function handleDeleteQuestion(qid) {
    setErr("");
    try {
      if (!user) throw new Error("You must be signed in.");
      await deleteDoc(doc(db, "polls", id, "questions", qid));
    } catch (e) {
      setErr(e.message || "Failed to delete question");
    }
  }

  function beginEdit(q) {
    setEditingId(q.id);
    setEditingText(q.text || "");
  }

  async function saveEdit(qid) {
    setErr("");
    try {
      if (!user) throw new Error("You must be signed in.");
      await updateDoc(doc(db, "polls", id, "questions", qid), { text: editingText.trim() });
      setEditingId(null);
      setEditingText("");
    } catch (e) {
      setErr(e.message || "Failed to update question");
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{title || "Untitled Poll"}</h1>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-medium">Description</h2>
        <form onSubmit={handleSaveDescription} className="space-y-3">
          <textarea
            className="min-h-[100px] w-full rounded-xl border px-3 py-2"
            placeholder="Write a short description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="rounded-xl border px-4 py-2 hover:bg-gray-50" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 text-lg font-medium">Questions</h2>

        <form onSubmit={handleAddQuestion} className="mb-4 flex gap-2">
          <input className="flex-1 rounded-xl border px-3 py-2"
                 placeholder="Add a question..."
                 value={newQ} onChange={(e) => setNewQ(e.target.value)} />
          <button className="rounded-xl border px-4 py-2 hover:bg-gray-50">Add</button>
        </form>

        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="flex items-start justify-between rounded-xl border p-3">
              {editingId === q.id ? (
                <div className="flex-1">
                  <input className="w-full rounded-xl border px-3 py-2"
                         value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                  <div className="mt-2 flex gap-3 text-sm">
                    <a href="#" className="text-blue-600 hover:underline"
                       onClick={(e) => { e.preventDefault(); saveEdit(q.id); }}>Save</a>
                    <a href="#" className="text-gray-600 hover:underline"
                       onClick={(e) => { e.preventDefault(); setEditingId(null); }}>Cancel</a>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-sm">{q.text}</p>
                  <div className="mt-1 flex gap-3 text-sm">
                    <a href="#" className="text-blue-600 hover:underline"
                       onClick={(e) => { e.preventDefault(); beginEdit(q); }}>Edit</a>
                    <a href="#" className="text-red-600 hover:underline"
                       onClick={(e) => { e.preventDefault(); handleDeleteQuestion(q.id); }}>Delete</a>
                  </div>
                </div>
              )}
            </li>
          ))}
          {questions.length === 0 && (
            <li className="rounded-xl border p-3 text-sm text-gray-600">No questions yet.</li>
          )}
        </ul>
      </section>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>
      )}
    </div>
  );
}
