import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signout, refreshClaims } = useAuth();
  const match = location.pathname.match(/^\/polls\/([^/]+)/);
  const currentPollId = match ? match[1] : null;

  return (
    <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-3 items-center p-4">
          <div />
          <h1 className="text-center text-xl font-semibold tracking-tight">
            <Link to="/" className="hover:opacity-80">Philanthropicode</Link>
          </h1>
          <div className="flex justify-end">
            <div className="relative">
              <button
                aria-label="Open menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border hover:bg-gray-50"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="sr-only">Menu</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {menuOpen && (
                <nav className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border bg-white shadow-xl" onMouseLeave={() => setMenuOpen(false)}>
                  <ul className="divide-y">
                    <li>
                      <Link to="/about" className="block px-4 py-3 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                        About
                      </Link>
                    </li>
                    <li>
                      <Link to="/donate" className="block px-4 py-3 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                        Donate
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/feedback"
                        state={{ pollId: currentPollId }}
                        className="block px-4 py-3 hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Feedback
                      </Link>
                    </li>
                    {!user ? (
                      <li>
                        <Link to="/auth" className="block px-4 py-3 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                          Sign up / Sign in
                        </Link>
                      </li>
                    ) : (
                      <>
                       {!user?.claims?.admin && (
                         <li>
                           <button
                             className="w-full px-4 py-3 text-left hover:bg-gray-50"
                             onClick={async () => { await refreshClaims(); setMenuOpen(false); }}
                           >
                             Refresh admin access
                           </button>
                         </li>
                       )}
                        <li>
                          <Link to="/profile" className="block px-4 py-3 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
                            Account
                          </Link>
                        </li>
                        <li>
                          <button
                            className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              await signout();
                              setMenuOpen(false);
                              navigate("/");
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
  );
}