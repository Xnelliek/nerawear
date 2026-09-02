const KEY = "nera-recent";
const MAX = 8;

export function addRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = getRecent().filter((x) => x !== id);
    const next = [id, ...cur].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as string[]) : [];
  } catch { return []; }
}
