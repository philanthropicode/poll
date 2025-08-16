import React from "react";

const DEFAULT_TITLES = [
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

export default function TitleList({ titles = DEFAULT_TITLES }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {titles.map((t, i) => (
        <li key={i} className="rounded-xl border p-3 hover:bg-gray-50">
          {t}
        </li>
      ))}
    </ul>
  );
}