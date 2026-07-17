import { useEffect } from "react";

function parseSudokuDigit(key, code) {
  if (/^[1-9]$/.test(key)) {
    return parseInt(key, 10);
  }
  if (code?.startsWith("Numpad") && code !== "Numpad0" && code !== "NumpadDecimal") {
    const n = parseInt(code.replace("Numpad", ""), 10);
    return n >= 1 && n <= 9 ? n : null;
  }
  return null;
}

export function useSudokuKeyboard({
  enabled,
  selectedCell,
  onSelectCell,
  onInput,
  onClear,
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const digit = parseSudokuDigit(e.key, e.code);
      if (digit !== null) {
        e.preventDefault();
        if (selectedCell) onInput(digit);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        if (selectedCell) onClear();
        return;
      }

      if (!selectedCell || !onSelectCell) return;

      const { row, col } = selectedCell;
      const moves = {
        ArrowUp: { row: Math.max(0, row - 1), col },
        ArrowDown: { row: Math.min(8, row + 1), col },
        ArrowLeft: { row, col: Math.max(0, col - 1) },
        ArrowRight: { row, col: Math.min(8, col + 1) },
      };

      const next = moves[e.key];
      if (next) {
        e.preventDefault();
        onSelectCell(next.row, next.col);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, selectedCell, onSelectCell, onInput, onClear]);
}
