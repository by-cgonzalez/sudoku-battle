import { useCallback, useEffect, useMemo, useState } from "react";
import { useGame } from "../contexts/GameContext";
import { getDifficulty } from "../lib/difficulty";
import { countSolvedCells } from "../lib/sudoku";
import {
  canUseHint,
  clearCellNotes,
  DEFAULT_BOARD_SIZE,
  formatElapsed,
  getConflictCells,
  HINT_COST,
  MAX_HINTS,
  normalizeGameOptions,
  playerScore,
  toggleNoteValue,
} from "../lib/features";
import {
  getDifficultyCompletions,
  recordSoloCompletion,
} from "../lib/soloStats";
import {
  SudokuBoard,
  Numpad,
  GameTools,
  TimerDisplay,
  BoardSizePicker,
  MatchHud,
  getCompletedDigits,
} from "./GameUI";
import { useSudokuKeyboard } from "../hooks/useSudokuKeyboard";

export function SoloScreen() {
  const {
    soloSession,
    leaveSolo,
    updateSoloCell,
    useSoloHint,
    recordSoloMistake,
    markSoloCompletionRecorded,
  } = useGame();
  const [selectedCell, setSelectedCell] = useState(null);
  const [wrongCell, setWrongCell] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [elapsed, setElapsed] = useState(0);
  const [draftMode, setDraftMode] = useState(false);
  const [notes, setNotes] = useState({});
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);
  const [completions, setCompletions] = useState(0);
  const [extrasOpen, setExtrasOpen] = useState(false);

  const finished = soloSession?.finished ?? false;
  const puzzle = soloSession?.puzzle;
  const solution = soloSession?.solution;
  const board = soloSession?.board;
  const difficulty = soloSession?.difficulty;
  const options = normalizeGameOptions(soloSession?.options);

  useEffect(() => {
    if (!difficulty) return;
    setCompletions(getDifficultyCompletions(difficulty));
  }, [difficulty]);

  useEffect(() => {
    if (!soloSession?.finished || soloSession.completionRecorded || !difficulty) return;
    const total = recordSoloCompletion(difficulty);
    setCompletions(total);
    markSoloCompletionRecorded();
  }, [soloSession?.finished, soloSession?.completionRecorded, difficulty, markSoloCompletionRecorded]);

  const conflictCells = useMemo(() => {
    if (!options.conflicts || !board || !puzzle) return null;
    return getConflictCells(board, puzzle);
  }, [options.conflicts, board, puzzle]);

  const handleNumberInput = useCallback((value, cellOverride = null) => {
    const cell = cellOverride || selectedCell;
    if (!cell || !soloSession || soloSession.finished) return;
    const { row, col } = cell;
    if (soloSession.puzzle[row][col] !== 0) return;

    if (options.notes && draftMode) {
      if (soloSession.board[row][col]) return;
      setSelectedCell(cell);
      setNotes((prev) => toggleNoteValue(prev, row, col, value));
      return;
    }

    if (value !== 0 && value !== soloSession.solution[row][col]) {
      setSelectedCell(cell);
      recordSoloMistake();
      setStatus({ message: "Número incorrecto", type: "error" });
      setWrongCell({ row, col });
      setTimeout(() => setWrongCell(null), 500);
      return;
    }

    setSelectedCell(cell);
    setStatus({ message: "", type: "" });
    setNotes((prev) => clearCellNotes(prev, row, col));
    updateSoloCell(row, col, value);
  }, [selectedCell, soloSession, options.notes, draftMode, updateSoloCell, recordSoloMistake]);

  const handleJoystickInput = useCallback(
    (row, col, value) => {
      handleNumberInput(value, { row, col });
    },
    [handleNumberInput]
  );

  const handleSelectCell = useCallback((row, col) => {
    if (!soloSession || soloSession.finished) return;
    setSelectedCell({ row, col });
  }, [soloSession]);

  const handleHint = useCallback(() => {
    if (!options.hints || !selectedCell || !soloSession || soloSession.finished) return;
    const { row, col } = selectedCell;
    if (soloSession.puzzle[row][col] !== 0) return;

    const check = canUseHint({
      solvedCount: soloSession.solvedCount || 0,
      hintsUsed: soloSession.hintsUsed || 0,
    });
    if (!check.ok) {
      setStatus({ message: check.reason, type: "error" });
      return;
    }

    const result = useSoloHint(row, col);
    if (!result?.ok) {
      setStatus({ message: result?.reason || "No se pudo usar el hint", type: "error" });
      return;
    }
    setNotes((prev) => clearCellNotes(prev, row, col));
    setStatus({
      message: `Hint usado (−${HINT_COST} pts). Quedan ${MAX_HINTS - ((soloSession.hintsUsed || 0) + 1)}`,
      type: "",
    });
  }, [options.hints, selectedCell, soloSession, useSoloHint]);

  useSudokuKeyboard({
    enabled: Boolean(soloSession && !finished),
    selectedCell,
    onSelectCell: handleSelectCell,
    onInput: handleNumberInput,
    onClear: () => handleNumberInput(0),
    onToggleDraft: options.notes ? () => setDraftMode((v) => !v) : undefined,
    onHint: options.hints ? handleHint : undefined,
    notesEnabled: options.notes,
    hintsEnabled: options.hints,
  });

  useEffect(() => {
    if (!options.timer || !soloSession || soloSession.finished) return;
    const sync = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - soloSession.startedAt) / 1000)));
    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [options.timer, soloSession]);

  if (!soloSession) return null;

  const diff = getDifficulty(difficulty);
  const totalEmpty = puzzle.flat().filter((c) => c === 0).length;
  const solved = countSolvedCells(board, solution, puzzle);
  const scorePlayer = {
    solvedCount: soloSession.solvedCount || solved,
    hintsUsed: soloSession.hintsUsed || 0,
  };
  const score = playerScore(scorePlayer);
  const hintCheck = canUseHint(scorePlayer);
  const canHintNow = Boolean(selectedCell) && hintCheck.ok;
  const mistakes = soloSession.mistakes || 0;

  const handleCellClick = (row, col, _fixed) => {
    if (finished) return;
    setSelectedCell({ row, col });
  };

  const completedDigits = useMemo(
    () => getCompletedDigits(board, puzzle),
    [board, puzzle]
  );

  const shortcuts = [
    "1-9",
    "0/Supr borrar",
    options.notes && "P notas",
    options.hints && "H hint",
    "flechas",
  ]
    .filter(Boolean)
    .join(" · ");

  const soloStats = (
    <div className="solo-stats card-small">
      <h3>🧩 Modo solitario</h3>
      <div className="solo-stat-row">
        <span>Progreso</span>
        <strong>{solved} / {totalEmpty}</strong>
      </div>
      <div className="solo-stat-row">
        <span>Puntos</span>
        <strong>{score}</strong>
      </div>
      <div className="solo-stat-row">
        <span>Fallos</span>
        <strong className={mistakes > 0 ? "stat-warn" : ""}>{mistakes}</strong>
      </div>
      <div className="solo-stat-row">
        <span>Veces {diff.label}</span>
        <strong>{completions}</strong>
      </div>
      {options.hints && (
        <div className="solo-stat-row">
          <span>Hints</span>
          <strong>{soloSession.hintsUsed || 0}/{MAX_HINTS}</strong>
        </div>
      )}
    </div>
  );

  return (
    <section className="screen active game-screen solo-screen">
      <div className="game-layout">
        <aside className="game-sidebar desktop-sidebar">
          <div className="difficulty-badge-game">{diff.icon} {diff.label}</div>

          {options.timer && <TimerDisplay seconds={elapsed} />}

          {soloStats}

          {options.hints && !hintCheck.ok && (
            <p className="hint-limit-note">{hintCheck.reason}</p>
          )}

          <p className={`status-message ${status.type}`}>{status.message}</p>
          <button type="button" className="btn btn-ghost" onClick={leaveSolo}>
            Volver al lobby
          </button>
        </aside>

        <main className="game-board-area">
          <MatchHud
            variant="solo"
            showTimer={options.timer}
            elapsed={elapsed}
            myProgress={solved}
            totalEmpty={totalEmpty}
            mistakes={mistakes}
            myScore={score}
            progressLabel="Avance"
            difficultyLabel={`${diff.icon} ${diff.label}`}
            hintsUsed={options.hints ? soloSession.hintsUsed || 0 : null}
            maxHints={MAX_HINTS}
            showProgressBar
          />

          <div className="board-toolbar">
            <BoardSizePicker value={boardSize} onChange={setBoardSize} />
            <GameTools
              showNotes={options.notes}
              showHints={options.hints}
              draftMode={draftMode}
              onToggleDraft={() => setDraftMode((v) => !v)}
              onHint={handleHint}
              hintsUsed={soloSession.hintsUsed || 0}
              disabled={finished}
              canHint={canHintNow}
              hintReason={hintCheck.ok ? "" : hintCheck.reason}
            />
          </div>
          {options.notes && draftMode && (
            <p className="draft-banner">Modo notas activo — los dígitos son solo candidatos</p>
          )}
          <div className="board-wrapper">
            <SudokuBoard
              board={board}
              puzzle={puzzle}
              attacks={[]}
              playerId="solo"
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              onJoystickInput={handleJoystickInput}
              joystickEnabled={!finished}
              draftMode={options.notes && draftMode}
              wrongCell={wrongCell}
              notes={options.notes ? notes : {}}
              conflictCells={conflictCells}
              boardSize={boardSize}
            />
          </div>
          <Numpad
            frozen={finished}
            draftMode={options.notes && draftMode}
            onInput={handleNumberInput}
            onClear={() => handleNumberInput(0)}
            boardSize={boardSize}
            completedDigits={completedDigits}
          />
          <p className="keyboard-hint desktop-hint">{shortcuts}</p>

          <p className={`status-message mobile-status ${status.type}`}>{status.message}</p>

          <div className="mobile-extras">
            <button
              type="button"
              className="mobile-extras-toggle"
              onClick={() => setExtrasOpen((v) => !v)}
              aria-expanded={extrasOpen}
            >
              {extrasOpen ? "▾" : "▸"} Más stats · {completions} en {diff.label}
            </button>
            {extrasOpen && (
              <div className="mobile-extras-body">
                {soloStats}
                {options.hints && !hintCheck.ok && (
                  <p className="hint-limit-note">{hintCheck.reason}</p>
                )}
              </div>
            )}
            <button type="button" className="btn btn-ghost mobile-leave" onClick={leaveSolo}>
              Volver al lobby
            </button>
          </div>
        </main>
      </div>

      {finished && (
        <div className="game-overlay">
          <div className="game-overlay-content">
            <h2>¡Completado!</h2>
            <p>
              Resolviste el sudoku {diff.label}
              {options.timer ? ` en ${formatElapsed(elapsed)}` : ""}.
              Puntuación: {score}
              {soloSession.hintsUsed ? ` · ${soloSession.hintsUsed} hints` : ""}
              {mistakes ? ` · ${mistakes} fallos` : ""}.
            </p>
            <p className="overlay-meta">
              Completados en {diff.label}: {completions}
            </p>
            <button type="button" className="btn btn-primary" onClick={leaveSolo}>
              Volver al lobby
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
