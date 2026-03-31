'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { BugData } from '@/game/types';
import { onShowCatchCard } from '@/game/eventBus';

const GameCanvas = dynamic(() => import('@/components/GameCanvas').then(m => m.GameCanvas), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#DEB882', color: '#2D6A4F', fontSize: 24, fontWeight: 'bold',
    }}>
      Loading Palo Verde Lane...
    </div>
  ),
});

const BugBook = dynamic(() => import('@/components/BugBook').then(m => m.BugBook), { ssr: false });
const CatchCard = dynamic(() => import('@/components/CatchCard').then(m => m.CatchCard), { ssr: false });

export default function Home() {
  const [caughtBugs, setCaughtBugs] = useState<BugData[]>([]);
  const [showBugBook, setShowBugBook] = useState(false);
  const [catchCardBug, setCatchCardBug] = useState<BugData | null>(null);

  useEffect(() => {
    const unsub = onShowCatchCard((bug) => {
      setCatchCardBug(bug);
    });
    return unsub;
  }, []);

  const handleCardDismiss = useCallback(() => {
    setCatchCardBug(prev => {
      if (prev) {
        setCaughtBugs(bugs => [...bugs, prev]);
      }
      return null;
    });
  }, []);

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Portrait orientation lock */}
      <div className="rotate-overlay">
        <span className="rotate-phone-icon">📱</span>
        <p style={{ fontSize: 22, fontWeight: 'bold', margin: 0 }}>Rotate your phone to play</p>
        <p style={{ fontSize: 15, opacity: 0.65, margin: 0 }}>This game is played in landscape</p>
      </div>

      <GameCanvas />

      <button
        onClick={() => setShowBugBook(true)}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 500,
          background: '#C4613A',
          color: '#fff',
          border: '2px solid #ffffff88',
          borderRadius: 10,
          padding: '12px 20px',
          fontSize: 16,
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontFamily: 'Georgia, serif',
          minWidth: 48,
          minHeight: 48,
          lineHeight: 1,
        }}
      >
        Bug Book ({caughtBugs.length})
      </button>

      {showBugBook && (
        <BugBook bugs={caughtBugs} onClose={() => setShowBugBook(false)} />
      )}

      {catchCardBug && (
        <CatchCard bug={catchCardBug} onDismiss={handleCardDismiss} />
      )}
    </main>
  );
}
