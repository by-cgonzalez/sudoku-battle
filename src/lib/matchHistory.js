const STORAGE_KEY = "sudoku-versus-history";
const MAX_ENTRIES = 40;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getVersusHistory(uid) {
  if (!uid) return [];
  const all = readAll();
  const list = Array.isArray(all[uid]) ? all[uid] : [];
  return list.slice().sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
}

export function recordVersusMatch(uid, entry) {
  if (!uid || !entry?.roomId) return;

  const all = readAll();
  const prev = Array.isArray(all[uid]) ? all[uid] : [];
  if (prev.some((m) => m.roomId === entry.roomId)) return;

  const next = [
    {
      roomId: entry.roomId,
      finishedAt: entry.finishedAt || Date.now(),
      won: Boolean(entry.won),
      opponentName: entry.opponentName || "Rival",
      opponentUid: entry.opponentUid || "",
      difficulty: entry.difficulty || "medium",
      battleMode: entry.battleMode || "race",
      mySolved: entry.mySolved || 0,
      oppSolved: entry.oppSolved || 0,
      myScore: entry.myScore ?? entry.mySolved ?? 0,
      oppScore: entry.oppScore ?? entry.oppSolved ?? 0,
      pointsEarned: entry.pointsEarned || 0,
    },
    ...prev,
  ].slice(0, MAX_ENTRIES);

  all[uid] = next;
  writeAll(all);
}

export function formatHistoryDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
