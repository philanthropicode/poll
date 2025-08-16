import React from "react";
import Hero from "../components/Hero";
import TitleList from "../components/TitleList";

export default function Home() {
  return (
    <>
      <section className="mb-8">
        <Hero />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-medium">Sample Titles</h2>
        <TitleList />
      </section>
    </>
  );
}