export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "Fácil",
    icon: "🌱",
    cellsToRemove: 35,
    winPoints: 15,
    cluesApprox: 46,
    desc: "Más pistas, ideal para empezar",
    accent: "#34d399",
  },
  medium: {
    id: "medium",
    label: "Medio",
    icon: "⚔️",
    cellsToRemove: 42,
    winPoints: 25,
    cluesApprox: 39,
    desc: "Equilibrio entre desafío y velocidad",
    accent: "#22d3ee",
  },
  hard: {
    id: "hard",
    label: "Difícil",
    icon: "🔥",
    cellsToRemove: 52,
    winPoints: 40,
    cluesApprox: 29,
    desc: "Pocas pistas, solo para expertos",
    accent: "#f59e0b",
  },
  legendary: {
    id: "legendary",
    label: "Legendaria",
    icon: "👑",
    cellsToRemove: 58,
    winPoints: 60,
    cluesApprox: 23,
    desc: "Extremo: casi sin pistas",
    accent: "#e879f9",
  },
};

export const DEFAULT_DIFFICULTY = "medium";

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
}
