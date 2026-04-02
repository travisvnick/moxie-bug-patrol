"use client";

import { useEffect, useState } from "react";
import eventBus from "@/game/eventBus";

const ZONE_NAME = "Palo Verde Lane";
const HINT_TEXT = "Hold to move, tap to catch!";
const HINT_FADE_MS = 3000;

export default function HUD() {
  const [bugsCaught, setBugsCaught] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const [hintFading, setHintFading] = useState(false);

  // Count total bugs caught (each bugCaught event = 1 catch)
  useEffect(() => {
    const handler = () => {
      setBugsCaught(prev => prev + 1);
    };
    eventBus.on("bugCaught", handler);
    return () => eventBus.off("bugCaught", handler);
  }, []);

  // Reset count when progress is cleared
  useEffect(() => {
    const handler = () => setBugsCaught(0);
    eventBus.on("resetProgress", handler);
    return () => eventBus.off("resetProgress", handler);
  }, []);

  // Fade hint after HINT_FADE_MS
  useEffect(() => {
    const fadeTimer = setTimeout(() => setHintFading(true), HINT_FADE_MS);
    const hideTimer = setTimeout(() => setHintVisible(false), HINT_FADE_MS + 600);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const labelStyle: React.CSSProperties = {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontWeight: "bold",
    color: "#fff",
    textShadow: "0 1px 4px rgba(0,0,0,0.7)",
    background: "rgba(18, 50, 80, 0.65)",
    borderRadius: 8,
    padding: "5px 10px",
    letterSpacing: 0.3,
    lineHeight: 1.3,
    pointerEvents: "none",
    userSelect: "none",
  };

  return (
    <>
      {/* Bugs caught counter — top-left */}
      <div
        style={{
          ...labelStyle,
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 400,
        }}
      >
        Bugs caught: {bugsCaught}
      </div>

      {/* Zone name — top-center */}
      <div
        style={{
          ...labelStyle,
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 400,
          whiteSpace: "nowrap",
        }}
      >
        {ZONE_NAME}
      </div>

      {/* Hint text — bottom-center, fades after 3 s */}
      {hintVisible && (
        <div
          style={{
            ...labelStyle,
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            fontSize: 14,
            opacity: hintFading ? 0 : 1,
            transition: "opacity 0.6s ease",
            whiteSpace: "nowrap",
          }}
        >
          {HINT_TEXT}
        </div>
      )}
    </>
  );
}
