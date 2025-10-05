// src/pages/RequestPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

// Optional: if you have auth context and want to attach uid
import { useAuth } from "../context/AuthContext";

const SUBJECT_LABELS = {
  sales: "Sales Inquiry",
  pilot: "Pilot Request",
  general: "General Inquiry",
};

export default function RequestPage() {
  const { currentUser } = useAuth(); // { uid, displayName, email, phoneNumber }
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const subjectKey = (params.get("subject") || "general").toLowerCase();

  const initialSubject = useMemo(
    () => SUBJECT_LABELS[subjectKey] || SUBJECT_LABELS.general,
    [subjectKey]
  );

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    subject: initialSubject,
    message: "",
    website: "",
  });

  useEffect(() => {
    // Prefill from auth when available
    setFormData((p) => ({
      ...p,
      fullName: p.fullName || currentUser?.displayName || "",
      email: p.email || currentUser?.email || "",
      phone: p.phone || currentUser?.phoneNumber || "",
    }));
  }, [currentUser]);

  const [state, setState] = useState({ loading: false, submitted: false, error: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setState({ loading: true, submitted: false, error: "" });

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.subject.trim()) {
      setState({ loading: false, submitted: false, error: "Please fill in required fields." });
      return;
    }
    if (formData.website?.trim()) {
      setState({ loading: false, submitted: true, error: "" });
      return;
    }

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        subject: formData.subject.trim(),
        message: formData.message.trim() || null,
        createdAt: serverTimestamp(),
        status: "new",
        source: "pricing",
        subjectKey,
        uid: currentUser?.uid || null,
      };
      await addDoc(collection(db, "contactRequests"), payload);
      setState({ loading: false, submitted: true, error: "" });
    } catch (err) {
      console.error(err);
      setState({ loading: false, submitted: false, error: "Something went wrong. Please try again." });
    }
  };

  if (state.submitted) {
    return (
      <div className="max-w-md mx-auto text-center p-6">
        <h1 className="text-2xl font-semibold mb-2">Thanks — we got it!</h1>
        <p>We’ll follow up at your email shortly.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Send a Message</h1>

      {state.error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          {state.error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot (hidden from humans, catches bots) */}
        <div className="hidden">
          <label>Website</label>
          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={handleChange}
            autoComplete="off"
            tabIndex="-1"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Full Name *</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
            className="w-full border rounded-lg p-2"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full border rounded-lg p-2"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Phone</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border rounded-lg p-2"
            autoComplete="tel"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Subject *</label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Message</label>
          <textarea
            name="message"
            rows="4"
            value={formData.message}
            onChange={handleChange}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <button
          type="submit"
          disabled={state.loading}
          className={`${
            state.loading ? "opacity-70 cursor-not-allowed" : ""
          } bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg w-full`}
        >
          {state.loading ? "Sending..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
