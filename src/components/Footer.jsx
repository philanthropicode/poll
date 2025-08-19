// src/components/Footer.jsx
import React from "react";

export default function Footer({ siteName = "Minimalist SPA" }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl p-4 text-xs text-gray-600">
        <div className="flex items-center justify-center gap-4">
          <span>
            © {year} {siteName}
          </span>
          {/* <Link className="hover:underline" to="/privacy">Privacy</Link> */}
          {/* <Link className="hover:underline" to="/terms">Terms</Link> */}
        </div>
      </div>
    </footer>
  );
}
