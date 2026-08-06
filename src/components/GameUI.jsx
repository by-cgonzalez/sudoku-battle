import { SIZE } from "../lib/sudoku";
import { ATTACK_LABELS, isCellBlocked } from "../lib/attacks";
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
import { DigitsJoystick } from "./DigitsJoystick";
import { useCellJoystick } from "../hooks/useCellJoystick";

function sameBox(r1, c1, r2, c2) {
  return Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3);
}

function cellValueAt(board, puzzle, row, col) {
  if (!puzzle || !board) return 0;
  return puzzle[row][col] !== 0 ? puzzle[row][col] : board[row][col] || 0;
}

/** Digits 1–9 that already appear 9 times on the board. */
export function getCompletedDigits(board, puzzle) {
  const counts = Array(10).fill(0);
  if (!board || !puzzle) return new Set();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = cellValueAt(board, puzzle, r, c);
      if (v >= 1 && v <= 9) counts[v] += 1;
    }
  }
  const done = new Set();
  for (let n = 1; n <= 9; n++) {
    if (counts[n] >= 9) done.add(n);
  }
  return done;
}

export function SudokuBoard({
  board,
  puzzle,
  attacks,
  playerId,
  selectedCell,
  onCellClick,
  onJoystickInput,
  joystickEnabled = true,
  draftMode = false,
  wrongCell,
  notes = {},
  highlight = true,
  conflictCells = null,
  celebrateCells = null,
  boardSize = DEFAULT_BOARD_SIZE,
}) {
  const sizePx = getBoardSize(boardSize).px;
  const selectedValue = selectedCell
    ? cellValueAt(board, puzzle, selectedCell.row, selectedCell.col)
    : 0;
  const completedDigits = getCompletedDigits(board, puzzle);

  const { joystick, bindCell, wrapClick } = useCellJoystick({
    enabled: Boolean(joystickEnabled && onJoystickInput),
    onSelectCell: (r, c, fixed, blocked) => onCellClick?.(r, c, fixed, blocked),
    onCommitDigit: onJoystickInput,
    completedDigits,
    draftMode,
  });

  return (
    <>
      <div
        className={`sudoku-grid board-size-${boardSize}${joystick ? " joystick-active" : ""}`}
        style={{ width: sizePx, maxWidth: "100%" }}
      >
        {Array.from({ length: SIZE }, (_, r) =>
          Array.from({ length: SIZE }, (_, c) => {
            const fixed = puzzle[r][c] !== 0;
            const value = cellValueAt(board, puzzle, r, c);
            const blocked = !fixed && isCellBlocked(attacks, playerId, r, c);
            const selected = selectedCell?.row === r && selectedCell?.col === c;
            const wrong = wrongCell?.row === r && wrongCell?.col === c;
            const inConflict = conflictCells?.has(notesKey(r, c));
            const celebrating = celebrateCells?.has(notesKey(r, c));
            const cellNotes = !value ? notes[notesKey(r, c)] || [] : [];
            const related =
              highlight &&
              selectedCell &&
              !selected &&
              selectedValue === 0 &&
              (selectedCell.row === r ||
                selectedCell.col === c ||
                sameBox(selectedCell.row, selectedCell.col, r, c));
            const sameNumber =
              highlight && selectedValue > 0 && value === selectedValue;
            const digitComplete = value > 0 && completedDigits.has(value);
            const editable = !fixed && !blocked;

            const classes = [
              "sudoku-cell",
              fixed && "fixed",
              blocked && "blocked",
              selected && "selected",
              wrong && "wrong",
              inConflict && "conflict",
              celebrating && "celebrate",
              related && "related",
              sameNumber && "same-number",
              digitComplete && "digit-complete",
              cellNotes.length > 0 && "has-notes",
              (r + 1) % 3 === 0 && r < 8 && "border-bottom-thick",
              (c + 1) % 3 === 0 && c < 8 && "border-right-thick",
            ]
              .filter(Boolean)
              .join(" ");

            const touch = bindCell(r, c, { fixed, blocked, editable });

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={classes}
                disabled={blocked}
                onClick={wrapClick(() => onCellClick(r, c, fixed, blocked))}
                {...touch}
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
      {joystick && (
        <DigitsJoystick
          x={joystick.x}
          y={joystick.y}
          activeDigit={joystick.digit}
          completedDigits={joystick.completedDigits}
          draftMode={joystick.draftMode}
        />
      )}
    </>
  );
}

export function Numpad({
  frozen,
  onInput,
  onClear,
  draftMode = false,
  boardSize = DEFAULT_BOARD_SIZE,
  completedDigits = null,
}) {
  const sizePx = getBoardSize(boardSize).px;
  const done = completedDigits instanceof Set ? completedDigits : new Set();
  return (
    <div className="numpad-area" style={{ width: sizePx, maxWidth: "100%" }}>
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          const complete = done.has(n);
          return (
            <button
              key={n}
              type="button"
              className={`numpad-btn ${draftMode ? "draft-active" : ""} ${complete ? "digit-complete" : ""}`}
              disabled={frozen || complete}
              onClick={() => onInput(n)}
              title={complete ? `${n} completado` : undefined}
            >
              {n}
            </button>
          );
        })}
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

export function TimerDisplay({ seconds, label = "Tiempo", compact = false }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const value = `${m}:${String(s).padStart(2, "0")}`;
  if (compact) {
    return (
      <div className="timer-display timer-display-compact" title={label}>
        <span className="timer-label">⏱️</span>
        <strong className="timer-value">{value}</strong>
      </div>
    );
  }
  return (
    <div className="timer-display card-small">
      <span className="timer-label">{label}</span>
      <strong className="timer-value">{value}</strong>
    </div>
  );
}

function formatHudTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRegenCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compact sticky HUD for mobile (and optional desktop strip). */
export function MatchHud({
  showTimer = true,
  elapsed = 0,
  myProgress = 0,
  oppProgress = null,
  totalEmpty = 0,
  mistakes = 0,
  myScore = null,
  activeAttacks = [],
  defenseCharges = 0,
  opponentName = "Rival",
  variant = "versus",
  progressLabel = "Tú",
  difficultyLabel = null,
  hintsUsed = null,
  maxHints = MAX_HINTS,
  showProgressBar = false,
  attackRegen = null,
  iLead = false,
  oppLeads = false,
  pointsGain = null,
}) {
  const pct =
    totalEmpty > 0 ? Math.min(100, Math.round((myProgress / totalEmpty) * 100)) : 0;

  return (
    <div className={`match-hud match-hud-${variant}${pointsGain ? " hud-score-flash" : ""}`}>
      <div className="match-hud-row">
        {difficultyLabel && (
          <div className="match-hud-chip">
            <span className="match-hud-k">Nivel</span>
            <strong>{difficultyLabel}</strong>
          </div>
        )}
        {showTimer && (
          <div className="match-hud-chip">
            <span className="match-hud-k">⏱️</span>
            <strong>{formatHudTime(elapsed)}</strong>
          </div>
        )}
        <div className={`match-hud-chip match-hud-score ${iLead ? "leading" : ""}`}>
          <span className="match-hud-k">
            {iLead ? "👑 " : ""}
            {progressLabel}
          </span>
          <strong className="match-hud-score-value">
            {myProgress}/{totalEmpty}
            {myScore != null ? ` · ${myScore}pts` : ""}
            {pointsGain != null && pointsGain.total > 0 && (
              <span className="hud-score-float" key={pointsGain.id || pointsGain.total}>
                +{pointsGain.total}
              </span>
            )}
          </strong>
        </div>
        {oppProgress != null && (
          <div className={`match-hud-chip rival ${oppLeads ? "leading" : ""}`}>
            <span className="match-hud-k">
              {oppLeads ? "👑 " : ""}
              {opponentName}
            </span>
            <strong>{oppProgress}/{totalEmpty}</strong>
          </div>
        )}
        <div className={`match-hud-chip ${mistakes > 0 ? "warn" : ""}`}>
          <span className="match-hud-k">Fallos</span>
          <strong>{mistakes}</strong>
        </div>
        {hintsUsed != null && (
          <div className="match-hud-chip">
            <span className="match-hud-k">💡</span>
            <strong>
              {hintsUsed}/{maxHints}
            </strong>
          </div>
        )}
        {defenseCharges > 0 && (
          <div className="match-hud-chip shield">
            <span className="match-hud-k">🛡️</span>
            <strong>{defenseCharges}</strong>
          </div>
        )}
      </div>
      {attackRegen && (
        <div className="match-hud-regen" title="Cada 3 min +2 usos por tipo de ataque">
          ⚔️ Límite {attackRegen.limit}/tipo · +{attackRegen.amount} en{" "}
          {formatRegenCountdown(attackRegen.nextInSec)}
        </div>
      )}
      {showProgressBar && (
        <div className="match-hud-bar" aria-hidden="true">
          <div className="match-hud-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      {activeAttacks.length > 0 && (
        <div className="match-hud-attacks">
          {activeAttacks.map((a) => {
            const remaining = Math.max(0, Math.ceil((a.expiresAt - Date.now()) / 1000));
            const label = ATTACK_LABELS[a.type]?.title || a.type;
            const icon = ATTACK_LABELS[a.type]?.icon || "⚡";
            return (
              <span key={a.id} className="match-hud-attack">
                {icon} {label} {remaining}s
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScorePanel({
  me,
  opponent,
  battleMode = "race",
  mistakes = 0,
  pointsGain = null,
  scorePulse = false,
}) {
  const mode = getBattleMode(battleMode);
  const myScore = playerScore(me);
  const oppScore = playerScore(opponent);
  const mySolved = me?.solvedCount || 0;
  const oppSolved = opponent?.solvedCount || 0;
  const myValue = battleMode === "score" ? myScore : mySolved;
  const oppValue = battleMode === "score" ? oppScore : oppSolved;
  const iLead = myValue > oppValue;
  const oppLeads = oppValue > myValue;
  const unit = battleMode === "score" ? "pts" : "aciertos";
  const oppName = opponent?.name?.split(" ")[0] || "Rival";

  return (
    <div className="score-panel score-panel-minimal" title={mode.desc}>
      <div
        className={`score-side me ${iLead ? "leading" : ""} ${me?.boardCompleted ? "done" : ""} ${scorePulse ? "score-pulse" : ""}`}
      >
        <div className="score-identity">
          {iLead && <span className="score-crown" aria-hidden="true">👑</span>}
          <span className="score-name">Tú{me?.boardCompleted ? " ✓" : ""}</span>
        </div>
        <strong className="score-num">
          {myValue}
          {pointsGain != null && pointsGain > 0 && (
            <span className="score-float" key={pointsGain.id || pointsGain.total}>
              +{pointsGain.total}
            </span>
          )}
        </strong>
        <span className={`score-meta${scorePulse ? " score-meta-flash" : ""}`}>
          {battleMode === "score" ? `${mySolved} aciertos` : `${myScore} pts`}
          {(me?.streak || 0) >= 5 ? ` · racha ${me.streak}` : ""}
          {" · "}
          {mistakes}✗
        </span>
        {pointsGain?.labels?.length > 0 && (
          <div className="score-gain-chips" key={`chips-${pointsGain.id}`}>
            {pointsGain.labels.map((label) => (
              <span key={label} className="score-gain-chip">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="score-center">
        <span className="vs-badge">VS</span>
        <span className="score-unit">{unit}</span>
      </div>
      <div className={`score-side opponent ${oppLeads ? "leading" : ""} ${opponent?.boardCompleted ? "done" : ""}`}>
        <div className="score-identity">
          {oppLeads && <span className="score-crown" aria-hidden="true">👑</span>}
          <span className="score-name">
            {oppName}
            {opponent?.boardCompleted ? " ✓" : ""}
          </span>
        </div>
        <strong className="score-num">{oppValue}</strong>
        <span className="score-meta">
          {battleMode === "score" ? `${oppSolved} aciertos` : `${oppScore} pts`}
        </span>
      </div>
    </div>
  );
}
