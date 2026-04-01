const STORAGE_KEY = "moxie-caught-bugs";

function isClient(): boolean {
  return typeof window !== "undefined";
}

export const SaveSystem = {
  load(): string[] {
    if (!isClient()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  },

  addCaught(key: string): void {
    if (!isClient()) return;
    const current = this.load();
    if (!current.includes(key)) {
      current.push(key);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }
  },

  clear(): void {
    if (!isClient()) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently skip
    }
  },
};
