export interface BugData {
  id: string;
  name: string;
  color: number;
  description: string;
  funFact: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  caughtAt: number;
}

export enum BugState {
  WANDER = 'WANDER',
  FLEE = 'FLEE',
  HIDDEN = 'HIDDEN',
}
