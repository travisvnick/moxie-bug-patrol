'use client';

import { useEffect, useState } from 'react';
import type { BugData } from '@/game/types';

const RARITY_COLORS: Record<string, string> = {
  common: '#8B8B8B',
  uncommon: '#4CAF50',
  rare: '#2196F3',
  legendary: '#FF9800',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

const BUG_EMOJI: Record<string, string> = {
  Shades: '🪳',
  Dusty: '🦂',
  'DJ Beetle': '🪲',
  'Neon Moth': '🦋',
  'Tiny Tim': '🐜',
};

export function CatchCard({ bug, onDismiss }: { bug: BugData; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 250);
  };

  const colorHex = `#${bug.color.toString(16).padStart(6, '0')}`;
  const rarityColor = RARITY_COLORS[bug.rarity] || '#888';
  const emoji = BUG_EMOJI[bug.name] || '🐛';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        transition: 'background 0.3s ease',
      }}
      onClick={handleDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFDF7',
          borderRadius: 20,
          padding: '32px 28px 24px',
          maxWidth: 340,
          width: '90vw',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          transform: visible ? 'scale(1)' : 'scale(0.7)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}
      >
        {/* Rarity badge */}
        <div
          style={{
            display: 'inline-block',
            background: rarityColor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
            padding: '3px 12px',
            borderRadius: 20,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          {RARITY_LABELS[bug.rarity]}
        </div>

        {/* Bug illustration area */}
        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto 16px',
            borderRadius: 16,
            background: `linear-gradient(135deg, ${colorHex}33, ${colorHex}66)`,
            border: `3px solid ${colorHex}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
          }}
        >
          {emoji}
        </div>

        {/* Bug name */}
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 24,
            fontFamily: 'Georgia, serif',
            color: '#2D3436',
          }}
        >
          {bug.name}
        </h2>

        {/* Description */}
        <p style={{ margin: '0 0 14px', fontSize: 14, color: '#636E72', lineHeight: 1.4 }}>
          {bug.description}
        </p>

        {/* Fun fact */}
        <div
          style={{
            background: '#FFF3E0',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: '#E65100',
            fontStyle: 'italic',
          }}
        >
          {bug.funFact}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          style={{
            background: '#2D6A4F',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 36px',
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer',
            minWidth: 48,
            minHeight: 48,
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
