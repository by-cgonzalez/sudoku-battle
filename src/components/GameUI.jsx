import { SIZE } from "../lib/sudoku";
import { isCellBlocked } from "../lib/attacks";
import {
  BOARD_SIZES,
  DEFAULT_BOARD_SIZE,
  getBattleMode,
  getBoardSize,
  HINT_COST,
  MAX_HINTS,
  notesKey,
  playerScore,
} from "../lib/features";

function sameBox(r1, c1, r2, c2) {
  return Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3);
}

export function SudokuBoard({
  board,
  puzzle,
  attacks,
  playerId,
  selectedCell,
  onCellClick,
  wrongCell,
  notes = {},
  highlight = true,
  conflictCells = null,
  boardSize = DEFAULT_BOARD_SIZE,
}) {
  const sizePx = getBoardSize(boardSize).px;
  const selectedValue =
    selectedCell && board
      ? puzzle[selectedCell.row][selectedCell.col] !== 0
        ? puzzle[selectedCell.row][selectedCell.col]
        : board[selectedCell.row][selectedCell.col]
      : 0;

  return (
    <div
      className={`sudoku-grid board-size-${boardSize}`}
      style={{ width: sizePx, maxWidth: "100%" }}
    >
      {Array.from({ length: SIZE }, (_, r) =>
        Array.from({ length: SIZE }, (_, c) => {
          const fixed = puzzle[r][c] !== 0;
          const value = fixed ? puzzle[r][c] : board[r][c];
          const blocked = !fixed && isCellBlocked(attacks, playerId, r, c);
          const selected = selectedCell?.row === r && selectedCell?.col === c;
          const wrong = wrongCell?.row === r && wrongCell?.col === c;
          const inConflict = conflictCells?.has(notesKey(r, c));
          const cellNotes = !value ? notes[notesKey(r, c)] || [] : [];
          const related =
            highlight &&
            selectedCell &&
            !selected &&
            (selectedCell.row === r ||
              selectedCell.col === c ||
              sameBox(selectedCell.row, selectedCell.col, r, c));
          const sameNumber =
            highlight && selectedValue > 0 && value === selectedValue && !selected;

          const classes = [
            "sudoku-cell",
            fixed && "fixed",
            blocked && "blocked",
            selected && "selected",
            wrong && "wrong",
            inConflict && "conflict",
            related && "related",
            sameNumber && "same-number",
            cellNotes.length > 0 && "has-notes",
            (r + 1) % 3 === 0 && r < 8 && "border-bottom-thick",
            (c + 1) % 3 === 0 && c < 8 && "border-right-thick",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={classes}
              disabled={fixed || blocked}
              onClick={() => onCellClick(r, c, fixed, blocked)}
            >
              {value ? (
                <span className="cell-value">{value}</span>
              ) : cellNotes.length > 0 ? (
                <span className="cell-notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n} className={cellNotes.includes(n) ? "on" : ""}>
                      {cellNotes.includes(n) ? n : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}

export function Numpad({ frozen, onInput, onClear, draftMode = false, boardSize = DEFAULT_BOARD_SIZE }) {
  const sizePx = getBoardSize(boardSize).px;
  return (
    <div className="numpad-area" style={{ width: sizePx, maxWidth: "100%" }}>
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            className={`numpad-btn ${draftMode ? "draft-active" : ""}`}
            disabled={frozen}
            onClick={() => onInput(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-secondary" disabled={frozen} onClick={onClear}>
        Borrar
      </button>
    </div>
  );
}

export function BoardSizePicker({ value = DEFAULT_BOARD_SIZE, onChange }) {
  return (
    <div className="board-size-picker" title="Tamaño del tablero">
      <span className="board-size-label">Tablero</span>
      <div className="board-size-options">
        {Object.values(BOARD_SIZES).map((size) => (
          <button
            key={size.id}
            type="button"
            className={`board-size-btn ${value === size.id ? "active" : ""}`}
            onClick={() => onChange?.(size.id)}
          >
            {size.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GameTools({
  showNotes = false,
  showHints = false,
  draftMode,
  onToggleDraft,
  onHint,
  hintCost = HINT_COST,
  hintsUsed = 0,
  maxHints = MAX_HINTS,
  disabled = false,
  canHint = true,
  hintReason = "",
}) {
  if (!showNotes && !showHints) return null;
  const remaining = Math.max(0, maxHints - hintsUsed);

  return (
    <div className={`game-tools tools-count-${Number(showNotes) + Number(showHints)}`}>
      {showNotes && (
        <button
          type="button"
          className={`tool-btn ${draftMode ? "active" : ""}`}
          disabled={disabled}
          onClick={onToggleDraft}
          title="Modo notas (P)"
        >
          <span className="tool-icon">✏️</span>
          <span className="tool-label">Notas</span>
        </button>
      )}
      {showHints && (
        <button
          type="button"
          className="tool-btn"
          disabled={disabled || !canHint}
          onClick={onHint}
          title={hintReason || `Hint (−${hintCost} pts · ${remaining}/${maxHints})`}
        >
          <span className="tool-icon">💡</span>
          <span className="tool-label">
            Hint −{hintCost} · {remaining}/{maxHints}
          </span>
        </button>
      )}
    </div>
  );
}

export function TimerDisplay({ seconds, label = "Tiempo" }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="timer-display card-small">
      <span className="timer-label">{label}</span>
      <strong className="timer-value">
        {m}:{String(s).padStart(2, "0")}
      </strong>
    </div>
  );
}

export function ScorePanel({ me, opponent, battleMode = "race" }) {
  const mode = getBattleMode(battleMode);
  const myScore = playerScore(me);
  const oppScore = playerScore(opponent);
  const mySolved = me?.solvedCount || 0;
  const oppSolved = opponent?.solvedCount || 0;
  const iLead = battleMode === "score" ? myScore > oppScore : mySolved > oppSolved;
  const oppLeads = battleMode === "score" ? oppScore > myScore : oppSolved > mySolved;

  return (
    <div className="score-panel">
      <div className="mode-chip" title={mode.desc}>
        {mode.icon} {mode.label}
      </div>
      <div className={`score-box me ${iLead ? "leading" : ""}`}>
        <span className="score-label">Tú</span>
        <div className="score-value-wrap">
          {iLead && <span className="score-crown" title="Vas ganando">👑</span>}
          <span className="score-value">{battleMode === "score" ? myScore : mySolved}</span>
        </div>
        <span className="score-sub">
          {battleMode === "score"
            ? `${mySolved} aciertos · ${me?.hintsUsed || 0} hints`
            : "aciertos"}
        </span>
      </div>
      <div className="vs-badge">VS</div>
      <div className={`score-box opponent ${oppLeads ? "leading" : ""}`}>
        <span className="score-label">{opponent?.name || "Rival"}</span>
        <div className="score-value-wrap">
          {oppLeads && <span className="score-crown" title="Va ganando">👑</span>}
          <span className="score-value">{battleMode === "score" ? oppScore : oppSolved}</span>
        </div>
        <span className="score-sub">
          {battleMode === "score"
            ? `${oppSolved} aciertos · ${opponent?.hintsUsed || 0} hints`
            : "aciertos"}
        </span>
      </div>
    </div>
  );
}
