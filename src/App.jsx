import React from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/Profile";
import AboutPage from "./pages/About";
import CreatePollPage from "./pages/CreatePoll";
import PollViewPage from "./pages/PollView";
import PollEditPage from "./pages/PollEdit";
import FeedbackPage from "./pages/Feedback";
import RequireAuth from "./routes/RequireAuth";
import PollAdminPage from "./pages/PollAdmin";
import VerifyEmailPage from "./pages/VerifyEmail";
import AuthActionPage from "./pages/AuthAction";
import PricingPage from "./pages/Pricing";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Header />
      <main className="mx-auto max-w-5xl p-4 flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/polls/new" element={<CreatePollPage />} />
          <Route path="/polls/:id" element={<PollViewPage />} />
          <Route path="/polls/:id/edit" element={<PollEditPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/polls/:id/admin" element={
            <RequireAuth>
              <PollAdminPage />
            </RequireAuth>
          } />
          <Route path="/verify" element={<VerifyEmailPage />} />
          <Route path="/auth/action" element={<AuthActionPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Routes>
      </main>
      <Footer siteName="Dario Bianco" />
    </div>
  );
}