export const ATTACK_TYPES = {
  FREEZE_INPUT: "freeze_input",
  BLOCK_LINE: "block_line",
  BLOCK_CELL: "block_cell",
};

export const MAX_ATTACK_USES = 3;
/** Every N correct placements grants 1 attack credit to choose and launch. */
export const ATTACK_CREDIT_EVERY = 5;
export const AUTO_ATTACK_EVERY = ATTACK_CREDIT_EVERY;
export const ATTACK_REGEN_INTERVAL_MS = 3 * 60 * 1000;
export const ATTACK_REGEN_AMOUNT = 2;
export const MAX_DEFENSE_BUYS = 3;
export const DEFENSE_COST = 5;

export const ATTACK_DURATIONS = {
  [ATTACK_TYPES.FREEZE_INPUT]: 4000,
  [ATTACK_TYPES.BLOCK_LINE]: 10000,
  [ATTACK_TYPES.BLOCK_CELL]: 10000,
};

export const ATTACK_LABELS = {
  [ATTACK_TYPES.FREEZE_INPUT]: {
    title: "Congelar entrada",
    desc: "El oponente no puede escribir durante 4 segundos",
    icon: "❄️",
  },
  [ATTACK_TYPES.BLOCK_LINE]: {
    title: "Bloquear línea",
    desc: "Bloquea una fila del oponente por 10 segundos",
    icon: "➖",
  },
  [ATTACK_TYPES.BLOCK_CELL]: {
    title: "Bloquear celda",
    desc: "Bloquea una celda del oponente por 10 segundos",
    icon: "🚫",
  },
};

export function emptyAttackUses() {
  return {
    [ATTACK_TYPES.FREEZE_INPUT]: 0,
    [ATTACK_TYPES.BLOCK_LINE]: 0,
    [ATTACK_TYPES.BLOCK_CELL]: 0,
  };
}

export function getAttackUses(player, type) {
  return player?.attackUses?.[type] || 0;
}

/** Max uses per attack type, growing +2 every 3 minutes of match time. */
export function getAttackUseLimit(startedAt, now = Date.now()) {
  const start =
    typeof startedAt?.toMillis === "function"
      ? startedAt.toMillis()
      : typeof startedAt?.seconds === "number"
        ? startedAt.seconds * 1000
        : typeof startedAt === "number"
          ? startedAt
          : null;
  if (!start) return MAX_ATTACK_USES;
  const elapsed = Math.max(0, now - start);
  const bonuses = Math.floor(elapsed / ATTACK_REGEN_INTERVAL_MS);
  return MAX_ATTACK_USES + bonuses * ATTACK_REGEN_AMOUNT;
}

export function getAttackRegenInfo(startedAt, now = Date.now()) {
  const limit = getAttackUseLimit(startedAt, now);
  const start =
    typeof startedAt?.toMillis === "function"
      ? startedAt.toMillis()
      : typeof startedAt?.seconds === "number"
        ? startedAt.seconds * 1000
        : typeof startedAt === "number"
          ? startedAt
          : null;
  if (!start) {
    return {
      limit,
      nextInSec: Math.ceil(ATTACK_REGEN_INTERVAL_MS / 1000),
      amount: ATTACK_REGEN_AMOUNT,
    };
  }
  const elapsed = Math.max(0, now - start);
  const nextAt = (Math.floor(elapsed / ATTACK_REGEN_INTERVAL_MS) + 1) * ATTACK_REGEN_INTERVAL_MS;
  return {
    limit,
    nextInSec: Math.max(0, Math.ceil((nextAt - elapsed) / 1000)),
    amount: ATTACK_REGEN_AMOUNT,
  };
}

/** True when reaching this solvedCount grants a new attack credit. */
export function shouldEarnAttackCredit(solvedCount) {
  return solvedCount > 0 && solvedCount % ATTACK_CREDIT_EVERY === 0;
}

/** @deprecated Use shouldEarnAttackCredit — kept for naming clarity in call sites. */
export function shouldTriggerAutoAttack(solvedCount) {
  return shouldEarnAttackCredit(solvedCount);
}

export function canUseAttackType(player, type, limit = MAX_ATTACK_USES) {
  return getAttackUses(player, type) < limit;
}

export function availableAttackTypes(player, limit = MAX_ATTACK_USES) {
  return Object.values(ATTACK_TYPES).filter((type) => canUseAttackType(player, type, limit));
}

export function pickRandomAttackType(player, limit = MAX_ATTACK_USES) {
  const available = availableAttackTypes(player, limit);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export function pickRandomAttackTarget(type, opponentBoard, puzzle) {
  if (type === ATTACK_TYPES.FREEZE_INPUT) {
    return { targetRow: null, targetCol: null };
  }

  if (type === ATTACK_TYPES.BLOCK_LINE) {
    return { targetRow: Math.floor(Math.random() * 9), targetCol: null };
  }

  const empties = [];
  const editable = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzle?.[r]?.[c] !== 0) continue;
      editable.push({ r, c });
      if (!opponentBoard?.[r]?.[c]) empties.push({ r, c });
    }
  }
  const pool = empties.length > 0 ? empties : editable;
  if (pool.length === 0) {
    return {
      targetRow: Math.floor(Math.random() * 9),
      targetCol: Math.floor(Math.random() * 9),
    };
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { targetRow: pick.r, targetCol: pick.c };
}

export function createAttack(type, targetId, attackerId, targetRow = null, targetCol = null) {
  const now = Date.now();
  return {
    id: `${attackerId}_${now}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    attackerId,
    targetId,
    targetRow,
    targetCol,
    createdAt: now,
    expiresAt: now + ATTACK_DURATIONS[type],
  };
}

export function getActiveAttacks(attacks, playerId) {
  const now = Date.now();
  return (attacks || []).filter(
    (a) => a.targetId === playerId && a.expiresAt > now
  );
}

export function isInputFrozen(attacks, playerId) {
  return getActiveAttacks(attacks, playerId).some(
    (a) => a.type === ATTACK_TYPES.FREEZE_INPUT
  );
}

export function isCellBlocked(attacks, playerId, row, col) {
  const active = getActiveAttacks(attacks, playerId);
  return active.some((a) => {
    if (a.type === ATTACK_TYPES.BLOCK_CELL) {
      return a.targetRow === row && a.targetCol === col;
    }
    if (a.type === ATTACK_TYPES.BLOCK_LINE) {
      return a.targetRow === row;
    }
    return false;
  });
}

export function pruneExpiredAttacks(attacks) {
  const now = Date.now();
  return (attacks || []).filter((a) => a.expiresAt > now);
}

/** Apply attack or consume defense. Returns { players, attacks, absorbed }. */
export function resolveIncomingAttack(players, attacks, attack) {
  const target = players.find((p) => p.uid === attack.targetId);
  const charges = target?.defenseCharges || 0;

  if (charges > 0) {
    const nextPlayers = players.map((p) =>
      p.uid === attack.targetId
        ? { ...p, defenseCharges: Math.max(0, (p.defenseCharges || 0) - 1) }
        : p
    );
    return { players: nextPlayers, attacks, absorbed: true };
  }

  return {
    players,
    attacks: [...pruneExpiredAttacks(attacks), attack],
    absorbed: false,
  };
}

export function incrementAttackUse(player, type) {
  const uses = { ...emptyAttackUses(), ...(player.attackUses || {}) };
  uses[type] = (uses[type] || 0) + 1;
  return uses;
}
