'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { BugData } from '@/game/types';

const GameCanvas = dynamic(() => import('@/components/GameCanvas').then(m => m.GameCanvas), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#87CEEB', color: '#2D6A4F', fontSize: 24, fontWeight: 'bold',
    }}>
      Loading Palo Verde Lane...
    </div>
  ),
});

const BugBook = dynamic(() => import('@/components/BugBook').then(m => m.BugBook), { ssr: false });

export default function Home() {
  const [caughtBugs, setCaughtBugs] = useState<BugData[]>([]);
  const [showBugBook, setShowBugBook] = useState(false);
  const bugCountRef = useRef(0);

  const handleBugCaught = useCallback((bug: BugData) => {
    setCaughtBugs(prev => [...prev, bug]);
    bugCountRef.current += 1;
  }, []);

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Portrait orientation lock — only visible on mobile in portrait mode */}
      <div className="rotate-overlay">
        <span className="rotate-phone-icon">📱</span>
        <p style={{ fontSize: 22, fontWeight: 'bold', margin: 0 }}>Rotate your phone to play</p>
        <p style={{ fontSize: 15, opacity: 0.65, margin: 0 }}>This game is played in landscape</p>
      </div>

      <GameCanvas onBugCaught={handleBugCaught} />

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
    </main>
  );
}
