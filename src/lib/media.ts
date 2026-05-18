// -- Update start
export type MediaCardItem = {
  session: string;
  title: string;
  poster?: string | null;
  href?: string;
  episode?: number | null;
  updatedAt?: number;
};

const WATCHLIST_KEY = "duckime_watchlist";
const HISTORY_KEY = "duckime_history";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures such as quota limits.
  }
}

function normalizeCard(item: MediaCardItem): MediaCardItem {
  return {
    session: item.session,
    title: item.title,
    poster: item.poster || null,
    href: item.href,
    episode: typeof item.episode === "number" ? item.episode : null,
    updatedAt: item.updatedAt || Date.now(),
  };
}

export function readWatchlist(): MediaCardItem[] {
  return readJson<MediaCardItem[]>(WATCHLIST_KEY, []);
}

export function readHistory(): MediaCardItem[] {
  return readJson<MediaCardItem[]>(HISTORY_KEY, []);
}

export function isInWatchlist(session: string) {
  return readWatchlist().some((item) => item.session === session);
}

export function toggleWatchlist(item: MediaCardItem) {
  const current = readWatchlist();
  const exists = current.findIndex((entry) => entry.session === item.session);

  if (exists >= 0) {
    const next = current.filter((entry) => entry.session !== item.session);
    writeJson(WATCHLIST_KEY, next);
    return { added: false, items: next };
  }

  const next = [normalizeCard(item), ...current].slice(0, 24);
  writeJson(WATCHLIST_KEY, next);
  return { added: true, items: next };
}

export function upsertHistory(item: MediaCardItem) {
  const current = readHistory();
  const key = `${item.session}:${item.episode ?? ""}`;
  const next = [normalizeCard(item), ...current.filter((entry) => `${entry.session}:${entry.episode ?? ""}` !== key)].slice(0, 40);
  writeJson(HISTORY_KEY, next);
  return next;
}

export function clearStorageKey(key: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
}

export { WATCHLIST_KEY, HISTORY_KEY };
// -- Update end
