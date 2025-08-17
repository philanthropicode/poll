// src/components/ShareButton.jsx
import React, { useState } from "react";

export default function ShareButton({ pollId, className = "" }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/polls/${pollId}`;

  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for insecure contexts/older browsers
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  }

  return (
    <button
      type="button"
      onClick={() => copy(url)}
      className={`rounded-xl border px-3 py-1 text-sm hover:bg-gray-50 ${className}`}
      aria-label="Copy share link"
    >
      {copied ? "Copied!" : "Share"}
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </button>
  );
}
