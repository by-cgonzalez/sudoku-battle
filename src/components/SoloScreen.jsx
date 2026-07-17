import { useCallback, useEffect, useState } from "react";
import { useGame } from "../contexts/GameContext";
import { getDifficulty } from "../lib/difficulty";
import { countSolvedCells } from "../lib/sudoku";
import { SudokuBoard, Numpad } from "./GameUI";
import { useSudokuKeyboard } from "../hooks/useSudokuKeyboard";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SoloScreen() {
  const { soloSession, leaveSolo, updateSoloCell } = useGame();
  const [selectedCell, setSelectedCell] = useState(null);
  const [wrongCell, setWrongCell] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [elapsed, setElapsed] = useState(0);

  const finished = soloSession?.finished ?? false;
  const puzzle = soloSession?.puzzle;
  const solution = soloSession?.solution;
  const board = soloSession?.board;
  const difficulty = soloSession?.difficulty;

  const handleNumberInput = useCallback((value) => {
    if (!selectedCell || !soloSession || soloSession.finished) return;
    const { row, col } = selectedCell;
    if (soloSession.puzzle[row][col] !== 0) return;

    if (value !== 0 && value !== soloSession.solution[row][col]) {
      setStatus({ message: "Número incorrecto", type: "error" });
      setWrongCell({ row, col });
      setTimeout(() => setWrongCell(null), 500);
      return;
    }

    setStatus({ message: "", type: "" });
    updateSoloCell(row, col, value);
  }, [selectedCell, soloSession, updateSoloCell]);

  const handleSelectCell = useCallback((row, col) => {
    if (!soloSession || soloSession.finished) return;
    if (soloSession.puzzle[row][col] !== 0) return;
    setSelectedCell({ row, col });
  }, [soloSession]);

  useSudokuKeyboard({
    enabled: Boolean(soloSession && !finished),
    selectedCell,
    onSelectCell: handleSelectCell,
    onInput: handleNumberInput,
    onClear: () => handleNumberInput(0),
  });

  useEffect(() => {
    if (!soloSession || soloSession.finished) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - soloSession.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [soloSession]);

  if (!soloSession) return null;

  const diff = getDifficulty(difficulty);
  const totalEmpty = puzzle.flat().filter((c) => c === 0).length;
  const solved = countSolvedCells(board, solution, puzzle);

  const handleCellClick = (row, col, fixed) => {
    if (fixed || finished) return;
    setSelectedCell({ row, col });
  };

  return (
    <section className="screen active">
      <div className="game-layout">
        <aside className="game-sidebar">
          <div className="difficulty-badge-game">{diff.icon} {diff.label}</div>

          <div className="solo-stats card-small">
            <h3>🧩 Modo solitario</h3>
            <div className="solo-stat-row">
              <span>Progreso</span>
              <strong>{solved} / {totalEmpty}</strong>
            </div>
            <div className="solo-stat-row">
              <span>Tiempo</span>
              <strong>{formatTime(elapsed)}</strong>
            </div>
          </div>

          <p className={`status-message ${status.type}`}>{status.message}</p>
          <button type="button" className="btn btn-ghost" onClick={leaveSolo}>
            Volver al lobby
          </button>
        </aside>

        <main className="game-board-area">
          <div className="board-wrapper">
            <SudokuBoard
              board={board}
              puzzle={puzzle}
              attacks={[]}
              playerId="solo"
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              wrongCell={wrongCell}
            />
          </div>
          <Numpad
            frozen={finished}
            onInput={handleNumberInput}
            onClear={() => handleNumberInput(0)}
          />
          <p className="keyboard-hint">Teclado: 1-9 · 0/Supr borrar · flechas mover</p>
        </main>
      </div>

      {finished && (
        <div className="game-overlay">
          <div className="game-overlay-content">
            <h2>¡Completado!</h2>
            <p>Resolviste el sudoku {diff.label} en {formatTime(elapsed)}.</p>
            <button type="button" className="btn btn-primary" onClick={leaveSolo}>
              Volver al lobby
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
