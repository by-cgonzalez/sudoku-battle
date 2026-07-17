import { SIZE } from "../lib/sudoku";
import { isCellBlocked } from "../lib/attacks";

export function SudokuBoard({
  board,
  puzzle,
  attacks,
  playerId,
  selectedCell,
  onCellClick,
  wrongCell,
}) {
  return (
    <div className="sudoku-grid">
      {Array.from({ length: SIZE }, (_, r) =>
        Array.from({ length: SIZE }, (_, c) => {
          const fixed = puzzle[r][c] !== 0;
          const value = fixed ? puzzle[r][c] : board[r][c];
          const blocked = !fixed && isCellBlocked(attacks, playerId, r, c);
          const selected = selectedCell?.row === r && selectedCell?.col === c;
          const wrong = wrongCell?.row === r && wrongCell?.col === c;

          const classes = [
            "sudoku-cell",
            fixed && "fixed",
            blocked && "blocked",
            selected && "selected",
            wrong && "wrong",
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
              {value || ""}
            </button>
          );
        })
      )}
    </div>
  );
}

export function Numpad({ frozen, onInput, onClear }) {
  return (
    <div className="numpad-area">
      <div className="numpad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            className="numpad-btn"
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

export function ScorePanel({ me, opponent }) {
  const myScore = me?.solvedCount || 0;
  const oppScore = opponent?.solvedCount || 0;
  const iLead = myScore > oppScore;
  const oppLeads = oppScore > myScore;

  return (
    <div className="score-panel">
      <div className={`score-box me ${iLead ? "leading" : ""}`}>
        <span className="score-label">Tú</span>
        <div className="score-value-wrap">
          {iLead && <span className="score-crown" title="Vas ganando">👑</span>}
          <span className="score-value">{myScore}</span>
        </div>
        <span className="score-sub">aciertos</span>
      </div>
      <div className="vs-badge">VS</div>
      <div className={`score-box opponent ${oppLeads ? "leading" : ""}`}>
        <span className="score-label">{opponent?.name || "Rival"}</span>
        <div className="score-value-wrap">
          {oppLeads && <span className="score-crown" title="Va ganando">👑</span>}
          <span className="score-value">{oppScore}</span>
        </div>
        <span className="score-sub">aciertos</span>
      </div>
    </div>
  );
}
