// Event bus for Phaser ↔ React communication
// Uses a simple EventEmitter pattern

type Listener = (...args: unknown[]) => void;

class EventBus {
  private listeners: Map<string, Listener[]> = new Map();

  on(event: string, fn: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(fn);
  }

  off(event: string, fn: Listener): void {
    const fns = this.listeners.get(event);
    if (fns) {
      this.listeners.set(event, fns.filter((f) => f !== fn));
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const fns = this.listeners.get(event);
    if (fns) {
      fns.forEach((fn) => fn(...args));
    }
  }
}

const eventBus = new EventBus();
export default eventBus;
