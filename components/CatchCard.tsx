"use client";

import { useEffect, useState } from "react";
import eventBus from "@/game/eventBus";

interface CatchCardData {
  name: string;
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "32px 28px",
          maxWidth: 380,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Rarity badge */}
        <div
          style={{
            display: "inline-block",
            background: rarityColor,
            color: "#000",
            fontWeight: "bold",
            fontSize: 12,
            padding: "4px 14px",
            borderRadius: 12,
            marginBottom: 12,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {card.rarity}
        </div>

        {/* Bug name */}
        <h2
          style={{
            fontSize: 26,
            fontWeight: "bold",
            color: "#123250",
            margin: "0 0 16px",
            lineHeight: 1.2,
          }}
        >
          {card.name} Caught!
        </h2>

        {/* SVG illustration */}
        <div
          style={{
            background: "#f0f4f8",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 120,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/sprites/${card.spriteKey}.svg`}
            alt={card.name}
            style={{ width: 100, height: 100, objectFit: "contain" }}
          />
        </div>

        {/* Fun fact callout */}
        <div
          style={{
            background: "#EBF4FF",
            border: "2px solid #0C77D8",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 24,
            fontSize: 14,
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
            padding: "14px 44px",
            fontSize: 18,
            fontWeight: "bold",
            cursor: "pointer",
            minWidth: 140,
            minHeight: 48,
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
