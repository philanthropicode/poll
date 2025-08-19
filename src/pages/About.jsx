import React from "react";

export default function AboutPage() {
  const postTitle =
    "Finding the Lone Star’s North Star: A Poll for Texans Who Want Fair Representation";
  const postDate = "August 9, 2025";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">About</h1>

      <p className="text-sm text-gray-700">
        This project was created in support of the ideas discussed in my {postDate} post,
        <span className="font-medium"> “{postTitle}”</span>. It aims to provide an
        accessible, transparent way for Texans to participate in community-driven polling—
        sharing polls, submitting nuanced slider-based responses with optional comments, and
        respecting deadlines so results reflect the intended window of participation.
      </p>

      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-medium mb-1">Read more</h2>
        <p className="text-sm text-gray-700">
          Follow along on{" "}
          <a
            href="https://whodowewanttobe.substack.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Who Do We Want To Be? (Substack)
          </a>
          .
        </p>
      </div>
    </div>
  );
}
