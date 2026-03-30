'use client';

import type { BugData } from '@/game/types';
import { emitCatchCardDismissed } from '@/game/eventBus';

const BUG_EMOJIS: Record<string, string> = {
  'Shades': '🪳',
  'Dusty': '🦂',
  'DJ Beetle': '🪲',
  'Neon Moth': '🦋',
  'Tiny Tim': '🐜',
};

const RARITY_COLORS: Record<string, string> = {
  'Common': '#888888',
  'Uncommon': '#4CAF50',
  'Rare': '#2196F3',
  'Epic': '#9C27B0',
};

interface CatchCardProps {
  bug: BugData;
  onDismiss: () => void;
}

export function CatchCard({ bug, onDismiss }: CatchCardProps) {
  const handleDismiss = () => {
    emitCatchCardDismissed();
    onDismiss();
  };

  const rarityColor = RARITY_COLORS[bug.rarity] ?? '#888888';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 22,
          padding: '28px 36px 32px',
          maxWidth: 360,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          fontFamily: 'Georgia, serif',
          border: `3px solid ${rarityColor}`,
        }}
      >
        {/* Rarity badge */}
        <div
          style={{
            display: 'inline-block',
            background: rarityColor,
            color: '#fff',
            borderRadius: 20,
            padding: '4px 18px',
            fontSize: 12,
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            marginBottom: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {bug.rarity}
        </div>

        {/* Bug emoji illustration */}
        <div style={{ fontSize: 88, lineHeight: 1, margin: '4px 0 14px' }}>
          {BUG_EMOJIS[bug.name] ?? '🐛'}
        </div>

        {/* Bug name */}
        <h2
          style={{
            fontSize: 26,
            fontWeight: 'bold',
            color: '#1A3A2A',
            margin: '0 0 6px',
          }}
        >
          {bug.name}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: '#666',
            margin: '0 0 14px',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          {bug.description}
        </p>

        {/* Fun fact */}
        <div
          style={{
            background: '#F0FBF4',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            color: '#2D6A4F',
            fontWeight: 'bold',
            margin: '0 0 22px',
            border: '2px solid #C0E8D0',
            lineHeight: 1.5,
            fontFamily: 'sans-serif',
          }}
        >
          💡 {bug.fact}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          style={{
            background: '#2D6A4F',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '14px 40px',
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'Georgia, serif',
            boxShadow: '0 4px 14px rgba(45, 106, 79, 0.4)',
            letterSpacing: 0.5,
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
