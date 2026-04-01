"use client";

import { useEffect, useState } from "react";
import eventBus from "@/game/eventBus";

interface CatchCardData {
  name: string;
  speciesType: string;
  funFact: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary";
  spriteKey: string;
}

const RARITY_COLORS: Record<string, string> = {
  Common:    "#44DD44",
  Uncommon:  "#FFCC00",
  Rare:      "#FF6600",
  Legendary: "#FF44FF",
};

export default function CatchCard() {
  const [card, setCard] = useState<CatchCardData | null>(null);

  useEffect(() => {
    const handler = (data: unknown) => {
      setCard(data as CatchCardData);
    };
    eventBus.on("bugCaught", handler);
    return () => eventBus.off("bugCaught", handler);
  }, []);

  if (!card) return null;

  const handleDismiss = () => {
    setCard(null);
    eventBus.emit("catchCardDismissed");
  };

  const rarityColor = RARITY_COLORS[card.rarity] ?? "#44DD44";

  return (
    // Overlay — scrollable so nothing is ever clipped on short viewports
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        overflowY: "auto",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      {/* Card — stop click-through to overlay dismiss */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "18px 20px 20px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          // Shrink if needed, scroll internally as absolute last resort
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        {/* Rarity badge */}
        <div
          style={{
            display: "inline-block",
            background: rarityColor,
            color: "#000",
            fontWeight: "bold",
            fontSize: 11,
            padding: "3px 12px",
            borderRadius: 10,
            marginBottom: 8,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {card.rarity}
        </div>

        {/* Bug name */}
        <h2
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: "#123250",
            margin: "0 0 2px",
            lineHeight: 1.2,
          }}
        >
          {card.name} Caught!
        </h2>

        {/* Species type — small subtitle */}
        <p
          style={{
            fontSize: 13,
            color: "#6B87A0",
            margin: "0 0 12px",
            fontStyle: "italic",
          }}
        >
          the {card.speciesType}
        </p>

        {/* SVG illustration */}
        <div
          style={{
            background: "#f0f4f8",
            borderRadius: 14,
            padding: "12px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/sprites/${card.spriteKey}.svg`}
            alt={card.name}
            style={{ width: 80, height: 80, objectFit: "contain" }}
          />
        </div>

        {/* Fun fact callout */}
        <div
          style={{
            background: "#EBF4FF",
            border: "2px solid #0C77D8",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#123250",
            lineHeight: 1.5,
            textAlign: "left",
          }}
        >
          <strong style={{ color: "#0C77D8" }}>Fun Fact: </strong>
          {card.funFact}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            background: "#0C77D8",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "13px 44px",
            fontSize: 17,
            fontWeight: "bold",
            cursor: "pointer",
            minWidth: 130,
            minHeight: 48,
            width: "100%",
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
