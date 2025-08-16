import React, { useState } from "react";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
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
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-3 items-center p-4">
            {/* Left spacer to keep title centered */}
            <div />

            {/* Centered site title */}
            <h1 className="text-center text-xl font-semibold tracking-tight">
              Minimalist SPA
            </h1>

            {/* Right-aligned hamburger */}
            <div className="flex justify-end">
              <div className="relative">
                <button
                  aria-label="Open menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border hover:bg-gray-50"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span className="sr-only">Menu</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                {menuOpen && (
                  <nav
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border bg-white shadow-xl"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    <ul className="divide-y">
                      {!loggedIn ? (
                        <li>
                          <button
                            className="w-full px-4 py-3 text-left hover:bg-gray-50"
                            onClick={() => {
                              setLoggedIn(true);
                              setMenuOpen(false);
                            }}
                          >
                            Sign up / Sign in
                          </button>
                        </li>
                      ) : (
                        <>
                          <li>
                            <a
                              href="#account"
                              className="block px-4 py-3 hover:bg-gray-50"
                              onClick={() => setMenuOpen(false)}
                            >
                              Account
                            </a>
                          </li>
                          <li>
                            <button
                              className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setLoggedIn(false);
                                setMenuOpen(false);
                              }}
                            >
                              Sign out
                            </button>
                          </li>
                        </>
                      )}
                    </ul>
                  </nav>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

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
