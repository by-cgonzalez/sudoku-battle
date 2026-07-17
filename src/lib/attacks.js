export const ATTACK_TYPES = {
  FREEZE_INPUT: "freeze_input",
  BLOCK_LINE: "block_line",
  BLOCK_CELL: "block_cell",
};

export const ATTACK_DURATIONS = {
  [ATTACK_TYPES.FREEZE_INPUT]: 3000,
  [ATTACK_TYPES.BLOCK_LINE]: 10000,
  [ATTACK_TYPES.BLOCK_CELL]: 10000,
};

export const ATTACK_LABELS = {
  [ATTACK_TYPES.FREEZE_INPUT]: {
    title: "Congelar entrada",
    desc: "El oponente no puede escribir durante 3 segundos",
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

export function createAttack(type, targetId, attackerId, targetRow = null, targetCol = null) {
  const now = Date.now();
  return {
    id: `${attackerId}_${now}`,
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
