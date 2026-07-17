import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { getDifficulty } from "../lib/difficulty";
import {
  ATTACK_TYPES,
  ATTACK_LABELS,
  isInputFrozen,
  getActiveAttacks,
  isCellBlocked,
} from "../lib/attacks";
import { SudokuBoard, Numpad, ScorePanel } from "./GameUI";
import { HeadToHeadPanel } from "./HeadToHeadPanel";
import { useSudokuKeyboard } from "../hooks/useSudokuKeyboard";

function AttackModal({ onSelect, onClose }) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h3>¡Acierto! Elige tu ataque</h3>
        <p className="subtitle">Impacta a tu oponente antes de que te alcance</p>
        <div className="attack-options">
          {Object.entries(ATTACK_LABELS).map(([type, info]) => (
            <button key={type} type="button" className="attack-btn" onClick={() => onSelect(type)}>
              <span className="attack-icon">{info.icon}</span>
              <span className="attack-title">{info.title}</span>
              <span className="attack-desc">{info.desc}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Saltar ataque</button>
      </div>
    </div>
  );
}

export function GameScreen() {
  const { user } = useAuth();
  const { room, rivalry, gameService, leaveRoom, getOpponent, getMe } = useGame();

  const [selectedCell, setSelectedCell] = useState(null);
  const [attackModal, setAttackModal] = useState(false);
  const [pendingAttack, setPendingAttack] = useState(null);
  const [attackTargetMode, setAttackTargetMode] = useState(null);
  const [attackHint, setAttackHint] = useState("");
  const [status, setStatus] = useState({ message: "", type: "" });
  const [wrongCell, setWrongCell] = useState(null);
  const [tick, setTick] = useState(0);

  const me = room && user ? getMe(room) : null;
  const opponent = room && user ? getOpponent(room) : null;
  const attacks = room?.attacks || [];
  const myBoard = room && user ? room.boards[user.uid] : null;
  const frozen = user ? isInputFrozen(attacks, user.uid) : false;
  const activeAttacks = user ? getActiveAttacks(attacks, user.uid) : [];
  const diff = getDifficulty(room?.difficulty);
  const finished = room?.status === "finished";
  const won = room?.winner === user?.uid;

  const handleNumberInput = useCallback(async (value) => {
    if (!selectedCell || !room || !user || frozen) return;
    const { row, col } = selectedCell;

    try {
      setStatus({ message: "", type: "" });
      const result = await gameService.placeNumber(room.id, row, col, value);
      if (result.wasCorrect && value !== 0) {
        setAttackModal(true);
        setPendingAttack(null);
        setAttackTargetMode(null);
      }
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
      setWrongCell({ row, col });
      setTimeout(() => setWrongCell(null), 500);
    }
  }, [selectedCell, room, user, frozen, gameService]);

  const handleSelectCell = useCallback((row, col) => {
    if (!room || !user) return;
    if (room.puzzle[row][col] !== 0) return;
    if (isCellBlocked(attacks, user.uid, row, col)) return;
    setSelectedCell({ row, col });
  }, [room, user, attacks]);

  useSudokuKeyboard({
    enabled: Boolean(room && user && !finished && !frozen && !attackModal && !attackTargetMode),
    selectedCell,
    onSelectCell: handleSelectCell,
    onInput: handleNumberInput,
    onClear: () => handleNumberInput(0),
  });

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  if (!room || !user) return null;

  const handleCellClick = (row, col, fixed, blocked) => {
    if (attackTargetMode && pendingAttack) {
      handleAttackTarget(row, col);
      return;
    }
    if (fixed || blocked) return;
    setSelectedCell({ row, col });
  };

  const selectAttack = (type) => {
    setPendingAttack(type);
    if (type === ATTACK_TYPES.FREEZE_INPUT) {
      executeAttack(type);
      return;
    }
    setAttackTargetMode(type);
    const hints = {
      [ATTACK_TYPES.BLOCK_LINE]: "Toca una celda de la fila que quieres bloquear",
      [ATTACK_TYPES.BLOCK_CELL]: "Toca la celda que quieres bloquear",
    };
    setAttackHint(hints[type] || "");
    setAttackModal(false);
  };

  const executeAttack = async (type, targetRow = null, targetCol = null) => {
    try {
      await gameService.launchAttack(room.id, type, targetRow, targetCol);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
    resetAttack();
  };

  const handleAttackTarget = (row, col) => {
    if (!pendingAttack || !attackTargetMode) return;
    const targetRow = attackTargetMode === ATTACK_TYPES.BLOCK_LINE ? row : row;
    const targetCol = attackTargetMode === ATTACK_TYPES.BLOCK_LINE ? null : col;
    executeAttack(pendingAttack, targetRow, targetCol);
  };

  const resetAttack = () => {
    setAttackModal(false);
    setPendingAttack(null);
    setAttackTargetMode(null);
    setAttackHint("");
  };

  void tick;

  return (
    <section className="screen active">
      <div className="game-layout">
        <aside className="game-sidebar">
          <div className="difficulty-badge-game">{diff.icon} {diff.label}</div>

          <ScorePanel me={me} opponent={opponent} />

          {opponent && (
            <HeadToHeadPanel rivalry={rivalry} opponent={opponent} compact />
          )}

          <div className="attack-info card-small">
            <h3>⚡ Ataques</h3>
            <p>Cada acierto te da un ataque:</p>
            <ul>
              <li><strong>Congelar</strong> — 3 seg sin escribir</li>
              <li><strong>Bloquear línea</strong> — 10 seg</li>
              <li><strong>Bloquear celda</strong> — 10 seg</li>
            </ul>
          </div>

          {activeAttacks.length > 0 && (
            <div className="attack-banner">
              {activeAttacks.map((a) => {
                const remaining = Math.max(0, Math.ceil((a.expiresAt - Date.now()) / 1000));
                const label = ATTACK_LABELS[a.type]?.title || a.type;
                return (
                  <div key={a.id} className="attack-effect">
                    ⚡ {label} — {remaining}s
                  </div>
                );
              })}
            </div>
          )}

          {attackHint && <p className="attack-hint">{attackHint}</p>}
          <p className={`status-message ${status.type}`}>{status.message}</p>
          <button type="button" className="btn btn-ghost" onClick={leaveRoom}>
            Abandonar
          </button>
        </aside>

        <main className="game-board-area">
          <div className="board-wrapper">
            {frozen && (
              <div className="frozen-overlay">
                <span>❄️ Entrada congelada</span>
              </div>
            )}
            <SudokuBoard
              board={myBoard}
              puzzle={room.puzzle}
              attacks={attacks}
              playerId={user.uid}
              selectedCell={selectedCell}
              onCellClick={handleCellClick}
              wrongCell={wrongCell}
            />
          </div>
          <Numpad
            frozen={frozen}
            onInput={handleNumberInput}
            onClear={() => handleNumberInput(0)}
          />
          <p className="keyboard-hint">Teclado: 1-9 · 0/Supr borrar · flechas mover</p>
        </main>
      </div>

      {attackModal && (
        <AttackModal onSelect={selectAttack} onClose={resetAttack} />
      )}

      {finished && (
        <div className="game-overlay">
          <div className="game-overlay-content">
            <h2>{won ? "¡Victoria!" : "Derrota"}</h2>
            <p>
              {won
                ? `Resolviste el sudoku primero (${diff.label}). +${diff.winPoints} pts`
                : `${room.winnerName} resolvió el sudoku primero. +5 pts por participar`}
            </p>
            <button type="button" className="btn btn-primary" onClick={leaveRoom}>
              Volver al lobby
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
