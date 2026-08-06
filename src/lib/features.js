import { SIZE } from "./sudoku";

export const HINT_COST = 3;
export const MAX_HINTS = 3;

export const POINTS_PER_HIT = 2;
export const POINTS_PER_LINE = 5;
export const POINTS_PER_BLOCK = 10;

/** Streak thresholds → point multipliers (consecutive correct placements). */
export const STREAK_MULTIPLIERS = [
  { min: 15, mult: 3 },
  { min: 10, mult: 2 },
  { min: 5, mult: 1.5 },
];

export const BOARD_SIZES = {
  sm: { id: "sm", label: "S", px: 340 },
  md: { id: "md", label: "M", px: 440 },
  lg: { id: "lg", label: "L", px: 560 },
};

export const DEFAULT_BOARD_SIZE = "md";

export const BATTLE_MODES = {
  race: {
    id: "race",
    label: "Por tiempo",
    icon: "⏱️",
    desc: "El primero en completar el sudoku gana",
  },
  score: {
    id: "score",
    label: "Por puntos",
    icon: "🎯",
    desc: "Ambos completan el sudoku; gana quien tenga más puntos",
  },
};

export const DEFAULT_BATTLE_MODE = "race";

export const GAME_OPTIONS = {
  hints: {
    id: "hints",
    label: "Hint",
    desc: `Rellena la celda (−${HINT_COST} pts; máx. ${MAX_HINTS}; requiere puntos; no da ataque ni racha)`,
    icon: "💡",
  },
  notes: {
    id: "notes",
    label: "Notas / lápiz",
    desc: "Los dígitos marcan candidatos en la celda (no colocan número)",
    icon: "✏️",
  },
  conflicts: {
    id: "conflicts",
    label: "Resaltar conflictos",
    desc: "Marca duplicados en fila/columna/bloque",
    icon: "⚠️",
  },
  timer: {
    id: "timer",
    label: "Temporizador",
    desc: "Muestra u oculta el tiempo (activo por defecto)",
    icon: "⏱️",
  },
};

export const DEFAULT_GAME_OPTIONS = {
  hints: false,
  notes: false,
  conflicts: false,
  timer: true,
};

export function getBattleMode(id) {
  return BATTLE_MODES[id] || BATTLE_MODES[DEFAULT_BATTLE_MODE];
}

export function normalizeGameOptions(options = {}) {
  return {
    hints: Boolean(options.hints ?? DEFAULT_GAME_OPTIONS.hints),
    notes: Boolean(options.notes ?? DEFAULT_GAME_OPTIONS.notes),
    conflicts: Boolean(options.conflicts ?? DEFAULT_GAME_OPTIONS.conflicts),
    timer: Boolean(options.timer ?? DEFAULT_GAME_OPTIONS.timer),
  };
}

export function streakMultiplier(streak) {
  const n = streak || 0;
  for (const { min, mult } of STREAK_MULTIPLIERS) {
    if (n >= min) return mult;
  }
  return 1;
}

function cellValue(board, puzzle, row, col) {
  return puzzle[row][col] !== 0 ? puzzle[row][col] : board[row][col];
}

function isUnitSolved(board, puzzle, solution, cells) {
  return cells.every(({ r, c }) => cellValue(board, puzzle, r, c) === solution[r][c]);
}

/** Which units containing (row, col) are fully solved. */
export function completedUnitsAt(board, puzzle, solution, row, col) {
  const rowCells = Array.from({ length: SIZE }, (_, c) => ({ r: row, c }));
  const colCells = Array.from({ length: SIZE }, (_, r) => ({ r, c: col }));
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  const boxCells = [];
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) boxCells.push({ r, c });
  }
  return {
    row: isUnitSolved(board, puzzle, solution, rowCells),
    col: isUnitSolved(board, puzzle, solution, colCells),
    box: isUnitSolved(board, puzzle, solution, boxCells),
  };
}

/** Bonuses unlocked by completing the row/col/block that contain (row, col). */
export function completionBonuses(board, puzzle, solution, row, col) {
  const done = completedUnitsAt(board, puzzle, solution, row, col);
  let bonus = 0;
  if (done.row) bonus += POINTS_PER_LINE;
  if (done.col) bonus += POINTS_PER_LINE;
  if (done.box) bonus += POINTS_PER_BLOCK;
  return bonus;
}

/**
 * Full scoring breakdown for a correct placement after `nextStreak` aciertos.
 * Multiplier applies to the full award (hit + line/block bonuses).
 */
export function scorePlacementDetails(board, puzzle, solution, row, col, nextStreak) {
  const done = completedUnitsAt(board, puzzle, solution, row, col);
  const hit = POINTS_PER_HIT;
  const lineBonus =
    (done.row ? POINTS_PER_LINE : 0) + (done.col ? POINTS_PER_LINE : 0);
  const blockBonus = done.box ? POINTS_PER_BLOCK : 0;
  const base = hit + lineBonus + blockBonus;
  const mult = streakMultiplier(nextStreak);
  return {
    total: Math.round(base * mult),
    hit,
    lineBonus,
    blockBonus,
    mult,
    completedRow: done.row,
    completedCol: done.col,
    completedBox: done.box,
  };
}

/**
 * Points for a correct placement after `nextStreak` consecutive aciertos.
 */
export function pointsForPlacement(board, puzzle, solution, row, col, nextStreak) {
  return scorePlacementDetails(board, puzzle, solution, row, col, nextStreak).total;
}

/** Cell keys ("r-c") for units completed by placing at (row, col). */
export function celebrationCells(row, col, details) {
  const cells = new Set();
  if (!details) return cells;
  if (details.completedRow) {
    for (let c = 0; c < SIZE; c++) cells.add(`${row}-${c}`);
  }
  if (details.completedCol) {
    for (let r = 0; r < SIZE; r++) cells.add(`${r}-${col}`);
  }
  if (details.completedBox) {
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) cells.add(`${r}-${c}`);
    }
  }
  return cells;
}

export function placementScoreKey(row, col) {
  return `${row}-${col}`;
}

export function playerScore(player) {
  if (!player) return 0;
  const hints = player.hintsUsed || 0;
  const spent = player.pointsSpent || 0;
  // Versus: accumulated match score. Solo/legacy: 1 pt per solved cell.
  const earned =
    typeof player.score === "number" ? player.score : player.solvedCount || 0;
  return Math.max(0, earned - HINT_COST * hints - spent);
}

export function canUseHint(player) {
  const hintsUsed = player?.hintsUsed || 0;
  if (hintsUsed >= MAX_HINTS) {
    return { ok: false, reason: `Máximo ${MAX_HINTS} hints por partida` };
  }
  if (playerScore(player) < HINT_COST) {
    return {
      ok: false,
      reason: `Necesitas al menos ${HINT_COST} pts para un hint`,
    };
  }
  return { ok: true, remaining: MAX_HINTS - hintsUsed };
}

export function getBoardSize(id) {
  return BOARD_SIZES[id] || BOARD_SIZES[DEFAULT_BOARD_SIZE];
}

export function notesKey(row, col) {
  return `${row}-${col}`;
}

export function toggleNoteValue(notes, row, col, value) {
  const key = notesKey(row, col);
  const current = new Set(notes[key] || []);
  if (value === 0) {
    const next = { ...notes };
    delete next[key];
    return next;
  }
  if (current.has(value)) current.delete(value);
  else current.add(value);
  const next = { ...notes };
  if (current.size === 0) delete next[key];
  else next[key] = [...current].sort((a, b) => a - b);
  return next;
}

export function clearCellNotes(notes, row, col) {
  const key = notesKey(row, col);
  if (!notes[key]) return notes;
  const next = { ...notes };
  delete next[key];
  return next;
}

/** Returns a Set of "r-c" keys for cells that duplicate a number in row/col/box. */
export function getConflictCells(board, puzzle) {
  const conflicts = new Set();
  if (!board || !puzzle) return conflicts;

  const valueAt = (r, c) => (puzzle[r][c] !== 0 ? puzzle[r][c] : board[r][c]);

  const markDuplicates = (cells) => {
    const byValue = new Map();
    for (const cell of cells) {
      const v = valueAt(cell.r, cell.c);
      if (!v) continue;
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push(cell);
    }
    for (const group of byValue.values()) {
      if (group.length < 2) continue;
      for (const { r, c } of group) conflicts.add(notesKey(r, c));
    }
  };

  for (let r = 0; r < SIZE; r++) {
    markDuplicates(Array.from({ length: SIZE }, (_, c) => ({ r, c })));
  }
  for (let c = 0; c < SIZE; c++) {
    markDuplicates(Array.from({ length: SIZE }, (_, r) => ({ r, c })));
  }
  for (let br = 0; br < SIZE; br += 3) {
    for (let bc = 0; bc < SIZE; bc += 3) {
      const cells = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) cells.push({ r, c });
      }
      markDuplicates(cells);
    }
  }

  return conflicts;
}

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function startedAtMs(startedAt) {
  if (!startedAt) return null;
  if (typeof startedAt.toMillis === "function") return startedAt.toMillis();
  if (typeof startedAt.seconds === "number") return startedAt.seconds * 1000;
  if (typeof startedAt === "number") return startedAt;
  return null;
}

export function buildInviteText({ code, hostName, difficultyLabel, battleModeLabel }) {
  const link = getInviteUrl(code);
  return [
    `${hostName || "Un jugador"} te invita a Sudoku Battle`,
    `Código: ${code}`,
    `Dificultad: ${difficultyLabel}`,
    `Modalidad: ${battleModeLabel}`,
    `Únete aquí: ${link}`,
  ].join("\n");
}

export function getInviteUrl(code) {
  if (typeof window === "undefined") return `?join=${encodeURIComponent(code)}`;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("join", code);
  return url.toString();
}
