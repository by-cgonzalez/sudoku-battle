import { DEFAULT_DIFFICULTY } from "./difficulty";
import {
  DEFAULT_BATTLE_MODE,
  DEFAULT_GAME_OPTIONS,
  normalizeGameOptions,
} from "./features";

const STORAGE_KEY = "sudoku-lobby-prefs";

export function loadLobbyPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        difficulty: DEFAULT_DIFFICULTY,
        battleMode: DEFAULT_BATTLE_MODE,
        options: { ...DEFAULT_GAME_OPTIONS },
      };
    }
    const data = JSON.parse(raw);
    return {
      difficulty: data.difficulty || DEFAULT_DIFFICULTY,
      battleMode: data.battleMode || DEFAULT_BATTLE_MODE,
      options: normalizeGameOptions(data.options),
    };
  } catch {
    return {
      difficulty: DEFAULT_DIFFICULTY,
      battleMode: DEFAULT_BATTLE_MODE,
      options: { ...DEFAULT_GAME_OPTIONS },
    };
  }
}

export function saveLobbyPrefs({ difficulty, battleMode, options }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        difficulty: difficulty || DEFAULT_DIFFICULTY,
        battleMode: battleMode || DEFAULT_BATTLE_MODE,
        options: normalizeGameOptions(options),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}
