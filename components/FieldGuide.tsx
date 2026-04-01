"use client";

import { useEffect, useState } from "react";
import eventBus from "@/game/eventBus";

// All 5 bugs in the game — matches spawn entries in SpawnSystem
const ALL_BUGS = [
  { key: "shades",    name: "Shades",    speciesType: "Cockroach" },
  { key: "dusty",     name: "Dusty",     speciesType: "Bark Scorpion" },
  { key: "dj-beetle", name: "DJ Beetle", speciesType: "Palo Verde Beetle" },
  { key: "neon-moth", name: "Neon Moth", speciesType: "Sphinx Moth" },
  { key: "tiny-tim",  name: "Tiny Tim",  speciesType: "Harvester Ant" },
];

export default function FieldGuide() {
  const [isOpen, setIsOpen]     = useState(false);
  const [caughtKeys, setCaughtKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = (data: unknown) => {
      const { spriteKey } = data as { spriteKey: string };
      setCaughtKeys(prev => new Set([...prev, spriteKey]));
    };
    eventBus.on("bugCaught", handler);
    return () => eventBus.off("bugCaught", handler);
  }, []);

  const caughtCount = caughtKeys.size;

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

      {/* Field Guide overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {ALL_BUGS.map(bug => {
                const caught = caughtKeys.has(bug.key);
                return (
                  <div
                    key={bug.key}
                    style={{
                      background: caught ? "#EBF4FF" : "#f0f0f0",
                      border: `2px solid ${caught ? "#0C77D8" : "#ddd"}`,
                      borderRadius: 12,
                      padding: "10px 6px 8px",
                      textAlign: "center",
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
          </div>
        </div>
      )}
    </>
  );
}
