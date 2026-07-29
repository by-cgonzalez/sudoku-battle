const STORAGE_KEY = "sudoku-solo-stats";

function emptyStats() {
  return {
    byDifficulty: {
      easy: { completions: 0 },
      medium: { completions: 0 },
      hard: { completions: 0 },
    },
  };
}

export function loadSoloStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    const base = emptyStats();
    for (const id of Object.keys(base.byDifficulty)) {
      base.byDifficulty[id] = {
        completions: Number(parsed?.byDifficulty?.[id]?.completions) || 0,
      };
    }
    return base;
  } catch {
    return emptyStats();
  }
}

export function getDifficultyCompletions(difficultyId) {
  const stats = loadSoloStats();
  return stats.byDifficulty[difficultyId]?.completions || 0;
}

export function recordSoloCompletion(difficultyId) {
  const stats = loadSoloStats();
  if (!stats.byDifficulty[difficultyId]) {
    stats.byDifficulty[difficultyId] = { completions: 0 };
  }
  stats.byDifficulty[difficultyId].completions += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  return stats.byDifficulty[difficultyId].completions;
}
