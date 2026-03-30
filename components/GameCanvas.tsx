'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    let destroyed = false;

    (async () => {
      const { createGame } = await import('@/game/main');
      if (destroyed || !containerRef.current || gameRef.current) return;
      gameRef.current = createGame('game-container');
    })();

    return () => {
      destroyed = true;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id="game-container"
      ref={containerRef}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    />
  );
}
