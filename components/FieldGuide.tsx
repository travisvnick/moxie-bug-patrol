"use client";

import { useEffect, useState } from "react";
import eventBus from "@/game/eventBus";
import { SaveSystem } from "@/game/systems/SaveSystem";

// All 5 bugs in the game — data mirrors Bug.ts species definitions
const ALL_BUGS = [
  {
    key: "shades",
    name: "Shades",
    speciesType: "Cockroach",
    rarity: "Common" as const,
    funFact: "Cockroaches can hold their breath for 40 minutes and survive a week without their head!",
  },
  {
    key: "dusty",
    name: "Dusty",
    speciesType: "Bark Scorpion",
    rarity: "Common" as const,
    funFact: "Bark scorpions glow bright blue under UV light. That's how real pest techs find them at night!",
  },
  {
    key: "dj-beetle",
    name: "DJ Beetle",
    speciesType: "Palo Verde Beetle",
    rarity: "Uncommon" as const,
    funFact: "Palo verde beetles can grow up to 4 inches long — one of the biggest beetles in North America!",
  },
  {
    key: "neon-moth",
    name: "Neon Moth",
    speciesType: "Sphinx Moth",
    rarity: "Uncommon" as const,
    funFact: "Some moths navigate by moonlight and can detect a single pheromone molecule from miles away!",
  },
  {
    key: "tiny-tim",
    name: "Tiny Tim",
    speciesType: "Harvester Ant",
    rarity: "Common" as const,
    funFact: "Harvester ants can carry 50 times their own body weight. That's like you lifting a car!",
  },
];

type Bug = typeof ALL_BUGS[number];

const RARITY_COLORS: Record<string, string> = {
  Common:    "#44DD44",
  Uncommon:  "#FFCC00",
  Rare:      "#FF6600",
  Legendary: "#FF44FF",
};

export default function FieldGuide() {
  const [isOpen, setIsOpen]           = useState(false);
  const [caughtKeys, setCaughtKeys]   = useState<Set<string>>(new Set());
  const [detail, setDetail]           = useState<Bug | null>(null);
  const [confirming, setConfirming]   = useState(false);

  // Load persisted caught bugs on mount
  useEffect(() => {
    const saved = SaveSystem.load();
    if (saved.length > 0) {
      setCaughtKeys(new Set(saved));
    }
  }, []);

  useEffect(() => {
    const handler = (data: unknown) => {
      const { spriteKey } = data as { spriteKey: string };
      SaveSystem.addCaught(spriteKey);
      setCaughtKeys(prev => new Set([...prev, spriteKey]));
    };
    eventBus.on("bugCaught", handler);
    return () => eventBus.off("bugCaught", handler);
  }, []);

  const caughtCount = caughtKeys.size;

  function handleResetConfirmed() {
    SaveSystem.clear();
    setCaughtKeys(new Set());
    setConfirming(false);
    setIsOpen(false);
    eventBus.emit("resetProgress");
  }

  return (
    <>
      {/* Bug Book button — top-right, 52px tap target */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Field Guide"
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          width: 52,
          height: 52,
          borderRadius: 12,
          background: "#0C77D8",
          border: "2px solid rgba(255,255,255,0.8)",
          color: "#fff",
          fontSize: 11,
          fontWeight: "bold",
          fontFamily: "system-ui, -apple-system, sans-serif",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          zIndex: 500,
          boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          lineHeight: 1.2,
          letterSpacing: 0.3,
        }}
      >
        <span style={{ fontSize: 18 }}>&#128218;</span>
        <span>BUGS</span>
      </button>

      {/* Field Guide grid overlay */}
      {isOpen && !detail && (
        <div
          onClick={() => { setIsOpen(false); setConfirming(false); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.80)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 900,
            padding: 16,
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "18px 18px 22px",
              maxWidth: 400,
              width: "100%",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: "bold", color: "#123250" }}>
                Field Guide
              </h2>
              <button
                onClick={() => { setIsOpen(false); setConfirming(false); }}
                aria-label="Close Field Guide"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#666",
                  minHeight: 48,
                  minWidth: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                }}
              >
                &#x2715;
              </button>
            </div>

            {/* Completion counter */}
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#0C77D8", fontWeight: "bold" }}>
              {caughtCount}/{ALL_BUGS.length} caught
            </p>

            {/* Bug grid — 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {ALL_BUGS.map(bug => {
                const caught = caughtKeys.has(bug.key);
                return (
                  <div
                    key={bug.key}
                    onClick={caught ? () => setDetail(bug) : undefined}
                    style={{
                      background: caught ? "#EBF4FF" : "#f0f0f0",
                      border: `2px solid ${caught ? "#0C77D8" : "#ddd"}`,
                      borderRadius: 12,
                      padding: "10px 6px 8px",
                      textAlign: "center",
                      cursor: caught ? "pointer" : "default",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/sprites/${bug.key}.svg`}
                      alt={caught ? bug.name : "Unknown bug"}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                        filter: caught ? "none" : "brightness(0)",
                        opacity: caught ? 1 : 0.35,
                      }}
                    />
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: "bold",
                        color: caught ? "#123250" : "#aaa",
                        lineHeight: 1.3,
                      }}
                    >
                      {caught ? bug.name : "???"}
                    </div>
                    {caught && (
                      <div style={{ fontSize: 10, color: "#6B87A0", fontStyle: "italic", marginTop: 1 }}>
                        {bug.speciesType}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reset Progress */}
            {!confirming ? (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <button
                  onClick={() => setConfirming(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#aaa",
                    fontSize: 12,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: "8px 0",
                    minHeight: 44,
                  }}
                >
                  Reset Progress
                </button>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 16,
                  background: "#FFF3F3",
                  border: "2px solid #E53935",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#B71C1C", fontWeight: "bold" }}>
                  Reset all progress? This can&apos;t be undone.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button
                    onClick={() => setConfirming(false)}
                    style={{
                      flex: 1,
                      background: "#eee",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 0",
                      fontSize: 14,
                      fontWeight: "bold",
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetConfirmed}
                    style={{
                      flex: 1,
                      background: "#E53935",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 0",
                      fontSize: 14,
                      fontWeight: "bold",
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bug detail popup */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.80)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 950,
            padding: 16,
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: "12px 16px 14px",
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxSizing: "border-box",
            }}
          >
            {/* Rarity badge */}
            <div
              style={{
                display: "inline-block",
                background: RARITY_COLORS[detail.rarity] ?? "#44DD44",
                color: "#000",
                fontWeight: "bold",
                fontSize: 11,
                padding: "2px 10px",
                borderRadius: 10,
                marginBottom: 6,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {detail.rarity}
            </div>

            {/* Bug name */}
            <h2 style={{ fontSize: 22, fontWeight: "bold", color: "#123250", margin: "0 0 1px", lineHeight: 1.2 }}>
              {detail.name}
            </h2>

            {/* Species type */}
            <p style={{ fontSize: 12, color: "#6B87A0", margin: "0 0 8px", fontStyle: "italic" }}>
              the {detail.speciesType.toLowerCase()}
            </p>

            {/* Large SVG illustration */}
            <div
              style={{
                background: "#f0f4f8",
                borderRadius: 12,
                padding: "12px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/sprites/${detail.key}.svg`}
                alt={detail.name}
                style={{ width: 96, height: 96, objectFit: "contain" }}
              />
            </div>

            {/* Fun fact */}
            <div
              style={{
                background: "#EBF4FF",
                border: "2px solid #0C77D8",
                borderRadius: 10,
                padding: "8px 12px",
                marginBottom: 10,
                fontSize: 13,
                color: "#123250",
                lineHeight: 1.45,
                textAlign: "left",
              }}
            >
              <strong style={{ color: "#0C77D8" }}>Fun Fact: </strong>
              {detail.funFact}
            </div>

            {/* Close button */}
            <button
              onClick={() => setDetail(null)}
              style={{
                background: "#0C77D8",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "11px 44px",
                fontSize: 16,
                fontWeight: "bold",
                cursor: "pointer",
                minWidth: 130,
                minHeight: 48,
                width: "100%",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
