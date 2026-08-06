import { completedUnitsAt, playerScore } from "./features";

/** First player to claim this many 3×3 blocks wins instantly. */
export const ZONE_WIN_THRESHOLD = 5;

/** Firestore boards key for the contested shared grid in zones mode. */
export const SHARED_BOARD_KEY = "shared";

export const CAPTURE_COLORS = [
  { id: "cyan", label: "Cian", hex: "#22d3ee" },
  { id: "amber", label: "Ámbar", hex: "#f59e0b" },
  { id: "rose", label: "Rosa", hex: "#fb7185" },
  { id: "lime", label: "Lima", hex: "#a3e635" },
  { id: "violet", label: "Violeta", hex: "#a78bfa" },
  { id: "orange", label: "Naranja", hex: "#fb923c" },
];

export const DEFAULT_CAPTURE_COLOR = CAPTURE_COLORS[0].id;

export function getCaptureColor(id) {
  return CAPTURE_COLORS.find((c) => c.id === id) || CAPTURE_COLORS[0];
}

export function emptyZones() {
  return {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
  };
}

export function normalizeZones(zones) {
  const base = emptyZones();
  if (!zones || typeof zones !== "object") return base;
  for (let i = 0; i < 9; i++) {
    base[i] = zones[i] ?? zones[String(i)] ?? null;
  }
  return base;
}

/** 0–8 index for the 3×3 block containing (row, col). */
export function boxIndex(row, col) {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

export function boxOrigin(index) {
  const i = Number(index);
  return {
    row: Math.floor(i / 3) * 3,
    col: (i % 3) * 3,
  };
}

export function countZonesFor(zones, uid) {
  const map = normalizeZones(zones);
  let n = 0;
  for (let i = 0; i < 9; i++) {
    if (map[i] === uid) n += 1;
  }
  return n;
}

export function cellOwnerKey(row, col) {
  return `${row}-${col}`;
}

export function normalizeCellOwners(owners) {
  if (!owners || typeof owners !== "object") return {};
  return { ...owners };
}

/**
 * Last player who places the number that completes a 3×3 block claims it.
 * Returns { zones, capturedIndex } (capturedIndex null if block not completed).
 */
export function tryCaptureZone(zones, board, puzzle, solution, row, col, uid) {
  const map = normalizeZones(zones);
  const done = completedUnitsAt(board, puzzle, solution, row, col);
  if (!done.box) return { zones: map, capturedIndex: null };

  const idx = boxIndex(row, col);
  return {
    zones: { ...map, [idx]: uid },
    capturedIndex: idx,
  };
}

/** Drop zone ownership when the block is no longer fully solved. */
export function releaseZoneIfIncomplete(zones, board, puzzle, solution, row, col) {
  const map = normalizeZones(zones);
  const idx = boxIndex(row, col);
  if (!map[idx]) return map;
  const done = completedUnitsAt(board, puzzle, solution, row, col);
  if (done.box) return map;
  return { ...map, [idx]: null };
}

/** Cell keys belonging to a zone index. */
export function zoneCellKeys(index) {
  const { row: br, col: bc } = boxOrigin(index);
  const keys = [];
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) keys.push(`${r}-${c}`);
  }
  return keys;
}

export function resolveZonesWinner(players, zones) {
  const ranked = [...players].sort((a, b) => {
    const za = countZonesFor(zones, a.uid);
    const zb = countZonesFor(zones, b.uid);
    if (zb !== za) return zb - za;
    const scoreDiff = playerScore(b) - playerScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aTime = a.completedAt || Number.POSITIVE_INFINITY;
    const bTime = b.completedAt || Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  const top = ranked[0];
  return { winner: top.uid, winnerName: top.name };
}
