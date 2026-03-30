'use client';

import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import type { BugData } from '@/game/types';

interface Props {
  onBugCaught: (bug: BugData) => void;
}

export function GameCanvas({ onBugCaught }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const callbackRef = useRef(onBugCaught);
  callbackRef.current = onBugCaught;

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    let unsubscribe: (() => void) | undefined;

    (async () => {
      const [{ createGame }, { onBugCaught: subscribe }] = await Promise.all([
        import('@/game/main'),
        import('@/game/eventBus'),
      ]);

      if (!containerRef.current || gameRef.current) return;

      gameRef.current = createGame('game-container');
      unsubscribe = subscribe((bug) => callbackRef.current(bug));
    })();

    return () => {
      unsubscribe?.();
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
