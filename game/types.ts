export interface BugData {
  id: string;
  name: string;
  color: number;
  description: string;
  fact: string;
  rarity: string;
  caughtAt: number;
}

export enum BugState {
  WANDER = 'WANDER',
  FLEE = 'FLEE',
  HIDDEN = 'HIDDEN',
}
