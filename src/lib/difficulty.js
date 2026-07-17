export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "Fácil",
    icon: "🟢",
    cellsToRemove: 35,
    winPoints: 15,
    desc: "Más pistas, ideal para empezar",
  },
  medium: {
    id: "medium",
    label: "Medio",
    icon: "🟡",
    cellsToRemove: 42,
    winPoints: 25,
    desc: "Equilibrio entre desafío y velocidad",
  },
  hard: {
    id: "hard",
    label: "Difícil",
    icon: "🔴",
    cellsToRemove: 52,
    winPoints: 40,
    desc: "Pocas pistas, solo para expertos",
  },
};

export const DEFAULT_DIFFICULTY = "medium";

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES[DEFAULT_DIFFICULTY];
}
