import { db, firebase, isFirebaseConfigured } from "./firebase";

const RANKINGS = "rankings";
const LOCAL_KEY = "sudoku-versus-history";
const MAX_ENTRIES = 40;
const { FieldValue } = firebase.firestore;

function normalizeEntry(entry) {
  return {
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
  };
}

function readLocalAll() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeLocalAll(data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function readLocal(uid) {
  if (!uid) return [];
  const all = readLocalAll();
  return Array.isArray(all[uid]) ? all[uid].map(normalizeEntry) : [];
}

function clearLocal(uid) {
  if (!uid) return;
  const all = readLocalAll();
  if (!(uid in all)) return;
  delete all[uid];
  writeLocalAll(all);
}

function mergeHistory(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const entry of list || []) {
      if (!entry?.roomId || byId.has(entry.roomId)) continue;
      byId.set(entry.roomId, normalizeEntry(entry));
    }
  }
  return [...byId.values()]
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))
    .slice(0, MAX_ENTRIES);
}

function profileRef(uid) {
  return db.collection(RANKINGS).doc(uid);
}

export async function getVersusHistory(uid) {
  if (!uid) return [];

  const local = readLocal(uid);

  if (!isFirebaseConfigured()) {
    return mergeHistory(local);
  }

  try {
    const snap = await profileRef(uid).get();
    const cloud = Array.isArray(snap.data()?.versusHistory)
      ? snap.data().versusHistory
      : [];
    const merged = mergeHistory(cloud, local);

    if (local.length > 0) {
      await profileRef(uid).set(
        {
          versusHistory: merged,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      clearLocal(uid);
    }

    return merged;
  } catch {
    return mergeHistory(local);
  }
}

export async function recordVersusMatch(uid, entry) {
  if (!uid || !entry?.roomId) return;

  const normalized = normalizeEntry(entry);

  if (!isFirebaseConfigured()) {
    const all = readLocalAll();
    const prev = Array.isArray(all[uid]) ? all[uid] : [];
    if (prev.some((m) => m.roomId === normalized.roomId)) return;
    all[uid] = [normalized, ...prev].slice(0, MAX_ENTRIES);
    writeLocalAll(all);
    return;
  }

  try {
    await db.runTransaction(async (tx) => {
      const ref = profileRef(uid);
      const snap = await tx.get(ref);
      const prev = Array.isArray(snap.data()?.versusHistory)
        ? snap.data().versusHistory
        : [];
      if (prev.some((m) => m.roomId === normalized.roomId)) return;

      const local = readLocal(uid);
      const next = mergeHistory([normalized], prev, local);

      tx.set(
        ref,
        {
          versusHistory: next,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    clearLocal(uid);
  } catch {
    const all = readLocalAll();
    const prev = Array.isArray(all[uid]) ? all[uid] : [];
    if (prev.some((m) => m.roomId === normalized.roomId)) return;
    all[uid] = mergeHistory([normalized], prev);
    writeLocalAll(all);
  }
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
