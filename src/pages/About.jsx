import React from "react";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">About Philanthropicode</h1>

      <p className="text-gray-700 text-sm">
        <strong>Philanthropicode</strong> turns public feedback into a living mandate for
        collective action — helping communities, organizations, and institutions decide not
        just <em>what to do next</em>, but <em>who to become</em>.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Our Vision</h2>
        <p className="text-gray-700 text-sm">
          We believe culture shouldn’t be dictated from the top down — it should be built
          together. Philanthropicode exists to make collaboration measurable, transparent,
          and democratic.
        </p>
        <p className="text-gray-700 text-sm">
          Our platform helps groups of any size identify what their members truly value,
          transforming millions of individual voices into a collective compass — a guide for
          where communities, teams, and nations want to go next. By grounding decisions in
          shared values, Philanthropicode re-aligns how society allocates its attention,
          energy, and resources — from local organizations to global systems.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">How It Works</h2>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
          <li>
            <strong>Create a Space:</strong> Each organization, community, or initiative has
            its own private or public space for collaboration.
          </li>
          <li>
            <strong>Post Polls:</strong> Leaders and members can post polls visible to
            everyone or limited to select groups, roles, or geographic areas.
          </li>
          <li>
            <strong>Set Participation Rules:</strong> Choose who can vote — members,
            collaborators, or residents of a specific neighborhood, city, or country.
          </li>
          <li>
            <strong>See What Matters:</strong> Every vote and comment shapes a data-driven
            understanding of collective priorities and aspirations.
          </li>
        </ul>
        <p className="text-gray-700 text-sm">
          Together, these insights form a <em>living mandate</em> — the foundation for
          action that reflects the true will of your people.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Why It Matters</h2>
        <p className="text-gray-700 text-sm">
          Democracy isn’t just about elections — it’s about everyday alignment: knowing what
          a group values and acting on it together.
        </p>
        <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
          <li>Organizations can align budgets and projects with member priorities.</li>
          <li>Communities can measure and act on what residents care about most.</li>
          <li>Leaders can earn genuine mandates to act transparently and collaboratively.</li>
        </ul>
        <p className="text-gray-700 text-sm">
          When decisions reflect shared values, we build cultures of trust — and a society
          that works on what truly matters.
        </p>
      </section>

      <div className="rounded-2xl border p-4 space-y-2">
        <h2 className="text-lg font-medium">Join the Movement</h2>
        <p className="text-gray-700 text-sm">
          Start shaping your organization’s future — and, in time, our shared one. Create a
          space, post your first poll, and begin turning collective insight into collective
          action.
        </p>
        <a
          href="/"
          className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create a Space
        </a>
      </div>
    </div>
  );
}
