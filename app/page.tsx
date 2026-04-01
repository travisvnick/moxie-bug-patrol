"use client";

import dynamic from "next/dynamic";
import CatchCard from "@/components/CatchCard";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <GameCanvas />
      <CatchCard />
      <div id="orientation-lock">
        <div className="phone-icon" />
        <h2>Rotate Your Phone</h2>
        <p>Moxie Bug Patrol plays in landscape mode</p>
      </div>
    </>
  );
}
