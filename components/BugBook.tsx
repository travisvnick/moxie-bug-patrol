'use client';

import type { BugData } from '@/game/types';

interface Props {
  bugs: BugData[];
  onClose: () => void;
}

export function BugBook({ bugs, onClose }: Props) {
  return (
    <div style={overlay} onClick={onClose}>
      <div style={book} onClick={(e) => e.stopPropagation()}>
        <h2 style={title}>Bug Book</h2>

        {bugs.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', margin: '24px 0', fontStyle: 'italic' }}>
            No bugs caught yet — get out there!
          </p>
        ) : (
          <div style={grid}>
            {bugs.map((bug) => (
              <div key={bug.id} style={card}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: `#${bug.color.toString(16).padStart(6, '0')}`,
                    border: '2px solid #E8C99A',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, color: '#2D6A4F' }}>
                    {bug.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#777', marginTop: 2, lineHeight: 1.4 }}>
                    {bug.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, color: '#C4613A', fontSize: 13 }}>
          {bugs.length} / 5 bugs collected
        </div>

        <button onClick={onClose} style={closeBtn}>
          Close
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
};

const book: React.CSSProperties = {
  background: '#FFF8F0',
  borderRadius: 18,
  padding: 28,
  maxWidth: 520,
  width: '88vw',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  border: '3px solid #C4613A',
};

const title: React.CSSProperties = {
  fontSize: 26, fontWeight: 'bold',
  color: '#2D6A4F', textAlign: 'center',
  marginBottom: 18,
  fontFamily: 'Georgia, serif',
  letterSpacing: 1,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 12,
};

const card: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  background: '#ffffff',
  borderRadius: 10, padding: 12,
  border: '1px solid #E8C99A',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const closeBtn: React.CSSProperties = {
  display: 'block', margin: '18px auto 0',
  padding: '10px 32px',
  background: '#2D6A4F', color: '#fff',
  border: 'none', borderRadius: 9,
  fontSize: 16, fontWeight: 'bold',
  cursor: 'pointer', letterSpacing: 0.5,
};
