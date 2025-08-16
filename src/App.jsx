import React, { useState } from "react";
import Header from "./components/Header";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  const titles = [
    "Sample Title One",
    "Sample Title Two",
    "Sample Title Three",
    "Sample Title Four",
    "Sample Title Five",
    "Sample Title Six",
    "Sample Title Seven",
    "Sample Title Eight",
    "Sample Title Nine",
    "Sample Title Ten",
    "Sample Title Eleven",
    "Sample Title Twelve",
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header loggedIn={loggedIn} setLoggedIn={setLoggedIn} />

      {/* Content */}
      <main className="mx-auto max-w-5xl p-4">
        {/* Hero image */}
        <section className="mb-8">
          <div className="relative overflow-hidden rounded-2xl border">
            <img
              src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop"
              alt="Hero"
              className="h-56 w-full object-cover sm:h-72 md:h-80"
            />
          </div>
        </section>

        {/* Static list of 12 sample titles */}
        <section>
          <h2 className="mb-3 text-lg font-medium">Sample Titles</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {titles.map((t, i) => (
              <li
                key={i}
                className="rounded-xl border p-3 hover:bg-gray-50"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
