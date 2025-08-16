import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import FormPage from "./pages/Form";
import ProfilePage from "./pages/Profile";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header loggedIn={loggedIn} setLoggedIn={setLoggedIn} />

      <main className="mx-auto max-w-5xl p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/form" element={<FormPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}