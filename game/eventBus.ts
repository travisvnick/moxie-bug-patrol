import type { BugData } from './types';

export const EventBus = new EventTarget();

export function emitBugCaught(bug: BugData): void {
  EventBus.dispatchEvent(new CustomEvent('bugCaught', { detail: bug }));
}

export function onBugCaught(handler: (bug: BugData) => void): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<BugData>).detail);
  };
  EventBus.addEventListener('bugCaught', listener);
  return () => EventBus.removeEventListener('bugCaught', listener);
}
