import type { BugData } from './types';

export const EventBus = new EventTarget();

export function emitShowCatchCard(bug: BugData): void {
  EventBus.dispatchEvent(new CustomEvent('showCatchCard', { detail: bug }));
}

export function onShowCatchCard(handler: (bug: BugData) => void): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<BugData>).detail);
  };
  EventBus.addEventListener('showCatchCard', listener);
  return () => EventBus.removeEventListener('showCatchCard', listener);
}

export function emitCatchCardDismissed(): void {
  EventBus.dispatchEvent(new CustomEvent('catchCardDismissed'));
}

export function onCatchCardDismissed(handler: () => void): () => void {
  const listener = () => handler();
  EventBus.addEventListener('catchCardDismissed', listener);
  return () => EventBus.removeEventListener('catchCardDismissed', listener);
}
