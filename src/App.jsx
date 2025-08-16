import React from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/Profile";
import CreatePollPage from "./pages/CreatePoll";
import PollDetailPage from "./pages/PollDetail";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header />
      <main className="mx-auto max-w-5xl p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/polls/new" element={<CreatePollPage />} />
          <Route path="/polls/:id" element={<PollDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}