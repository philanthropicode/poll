import React from "react";

export default function Hero({
  src = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
  alt = "Hero",
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border">
      <img src={src} alt={alt} className="h-56 w-full object-cover sm:h-72 md:h-80" />
    </div>
  );
}