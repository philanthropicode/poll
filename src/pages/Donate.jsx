// src/pages/Donate.jsx
import React from "react";
export default function DonatePage() {
  const oneTime = "https://buy.stripe.com/your_one_time_link";
  const monthly = "https://buy.stripe.com/your_monthly_link";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Support the Platform</h1>
      <p className="text-sm text-gray-700">
        Your donation helps us build community-driven polling tools and open reporting.
      </p>
      
      <div className="grid sm:grid-cols-2 gap-3">
        <a href={oneTime} target="_blank" rel="noopener" className="rounded-xl border px-4 py-3 text-center hover:bg-gray-50">
          One-time donation
        </a>
        <a href={monthly} target="_blank" rel="noopener" className="rounded-xl border px-4 py-3 text-center hover:bg-gray-50">
          Monthly supporter
        </a>
      </div>
      {/* Optional: progress bar + sponsor wall */}
    </div>
  );
}
