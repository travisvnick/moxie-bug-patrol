export interface BugData {
  id: string;
  name: string;
  color: number;
  description: string;
  caughtAt: number;
}

export enum BugState {
  WANDER = 'WANDER',
  FLEE = 'FLEE',
}
