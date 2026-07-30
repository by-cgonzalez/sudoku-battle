import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { getDifficulty } from "../lib/difficulty";
import {
  ATTACK_TYPES,
  ATTACK_LABELS,
  ATTACK_COSTS,
  DEFENSE_COST,
  MAX_DEFENSE_BUYS,
  MAX_ATTACK_USES,
  isInputFrozen,
  getActiveAttacks,
  isCellBlocked,
  getAttackUses,
  canUseAttackType,
} from "../lib/attacks";
import {
  canUseHint,
  clearCellNotes,
  DEFAULT_BOARD_SIZE,
  formatElapsed,
  getBattleMode,
  getConflictCells,
  HINT_COST,
  MAX_HINTS,
  normalizeGameOptions,
  playerScore,
  startedAtMs,
  toggleNoteValue,
} from "../lib/features";
import { SudokuBoard, Numpad, ScorePanel, GameTools, TimerDisplay, BoardSizePicker } from "./GameUI";
import { HeadToHeadPanel } from "./HeadToHeadPanel";
import { useSudokuKeyboard } from "../hooks/useSudokuKeyboard";

export function GameScreen() {
  const { user } = useAuth();
  const { room, rivalry, gameService, leaveRoom, getOpponent, getMe } = useGame();

  const [selectedCell, setSelectedCell] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [wrongCell, setWrongCell] = useState(null);
  const [tick, setTick] = useState(0);
  const [draftMode, setDraftMode] = useState(false);
  const [notes, setNotes] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);
  const [shopBusy, setShopBusy] = useState(false);

  const options = normalizeGameOptions(room?.options);
  const me = room && user ? getMe(room) : null;
  const opponent = room && user ? getOpponent(room) : null;
  const attacks = room?.attacks || [];
  const myBoard = room && user ? room.boards[user.uid] : null;
  const frozen = user ? isInputFrozen(attacks, user.uid) : false;
  const activeAttacks = user ? getActiveAttacks(attacks, user.uid) : [];
  const diff = getDifficulty(room?.difficulty);
  const battle = getBattleMode(room?.battleMode);
  const finished = room?.status === "finished";
  const won = room?.winner === user?.uid;
  const myScore = playerScore(me);

  const conflictCells = useMemo(() => {
    if (!options.conflicts || !myBoard || !room?.puzzle) return null;
    return getConflictCells(myBoard, room.puzzle);
  }, [options.conflicts, myBoard, room?.puzzle]);

  const handleNumberInput = useCallback(async (value) => {
    if (!selectedCell || !room || !user || frozen) return;
    const { row, col } = selectedCell;

    if (options.notes && draftMode) {
      if (myBoard?.[row]?.[col]) return;
      setNotes((prev) => toggleNoteValue(prev, row, col, value));
      return;
    }

    try {
      setStatus({ message: "", type: "" });
      const result = await gameService.placeNumber(room.id, row, col, value);
      setNotes((prev) => clearCellNotes(prev, row, col));
      if (result.wasCorrect && result.autoAttack) {
        setStatus({
          message: result.autoAttackAbsorbed
            ? `${result.autoAttack.label} bloqueado por la defensa rival`
            : `Ataque auto: ${result.autoAttack.label}`,
          type: "",
        });
      }
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
      setWrongCell({ row, col });
      setTimeout(() => setWrongCell(null), 500);
    }
  }, [selectedCell, room, user, frozen, options.notes, draftMode, myBoard, gameService]);

  const handleSelectCell = useCallback((row, col) => {
    if (!room || !user) return;
    if (room.puzzle[row][col] !== 0) return;
    if (isCellBlocked(attacks, user.uid, row, col)) return;
    setSelectedCell({ row, col });
  }, [room, user, attacks]);

  const handleHint = useCallback(async () => {
    if (!options.hints || !selectedCell || !room || !user || frozen || finished) return;
    const check = canUseHint(me);
    if (!check.ok) {
      setStatus({ message: check.reason, type: "error" });
      return;
    }
    const { row, col } = selectedCell;
    try {
      const result = await gameService.useHint(room.id, row, col);
      setNotes((prev) => clearCellNotes(prev, row, col));
      setStatus({
        message: `Hint usado (−${result.cost} pts). Quedan ${MAX_HINTS - (result.hintsUsed || 0)}`,
        type: "",
      });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }, [options.hints, selectedCell, room, user, frozen, finished, me, gameService]);

  const handleBuyDefense = useCallback(async () => {
    if (!room || finished || shopBusy) return;
    try {
      setShopBusy(true);
      const result = await gameService.buyDefense(room.id);
      setStatus({
        message: `Defensa comprada (−${result.cost} pts). Escudos: ${result.defenseCharges}`,
        type: "",
      });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setShopBusy(false);
    }
  }, [room, finished, shopBusy, gameService]);

  const handleBuyAttack = useCallback(async (type) => {
    if (!room || finished || shopBusy) return;
    try {
      setShopBusy(true);
      const result = await gameService.buyAttack(room.id, type);
      setStatus({
        message: result.absorbed
          ? `${result.label} comprado (−${result.cost} pts) pero bloqueado por defensa`
          : `${result.label} lanzado (−${result.cost} pts)`,
        type: "",
      });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setShopBusy(false);
    }
  }, [room, finished, shopBusy, gameService]);

  useSudokuKeyboard({
    enabled: Boolean(room && user && !finished && !frozen),
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
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!options.timer || !room || finished) return;
    const start = startedAtMs(room.startedAt);
    if (!start) return;
    const sync = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [options.timer, room, finished]);

  if (!room || !user) return null;

  const handleCellClick = (row, col, fixed, blocked) => {
    if (fixed || blocked) return;
    setSelectedCell({ row, col });
  };

  void tick;

  const myFinal = playerScore(me);
  const oppFinal = playerScore(opponent);
  const hintCheck = canUseHint(me);
  const canHintNow = Boolean(selectedCell) && hintCheck.ok;
  const canBuyDefense =
    !finished &&
    (me?.defensesBought || 0) < MAX_DEFENSE_BUYS &&
    myScore >= DEFENSE_COST;

  const shortcuts = [
    "1-9",
    "0/Supr borrar",
    options.notes && "P notas",
    options.hints && "H hint",
    "flechas",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="screen active">
      <div className="game-layout">
        <aside className="game-sidebar">
          <div className="game-badges">
            <div className="difficulty-badge-game">{diff.icon} {diff.label}</div>
            <div className="difficulty-badge-game">{battle.icon} {battle.label}</div>
          </div>

          {options.timer && <TimerDisplay seconds={elapsed} />}

          <ScorePanel me={me} opponent={opponent} battleMode={room.battleMode || "race"} />

          {opponent && (
            <HeadToHeadPanel rivalry={rivalry} opponent={opponent} compact />
          )}

          <div className="attack-info card-small">
            <h3>⚔️ Combate</h3>
            <p>Cada acierto lanza un ataque al azar (máx. {MAX_ATTACK_USES} por tipo).</p>
            <ul>
              <li><strong>Congelar</strong> — 4 seg</li>
              <li><strong>Bloquear línea</strong> — 10 seg</li>
              <li><strong>Bloquear celda</strong> — 10 seg</li>
            </ul>
            <p className="shop-meta">
              Escudos: {me?.defenseCharges || 0} · Usos: ❄️{getAttackUses(me, ATTACK_TYPES.FREEZE_INPUT)}/{MAX_ATTACK_USES}
              {" · "}➖{getAttackUses(me, ATTACK_TYPES.BLOCK_LINE)}/{MAX_ATTACK_USES}
              {" · "}🚫{getAttackUses(me, ATTACK_TYPES.BLOCK_CELL)}/{MAX_ATTACK_USES}
            </p>
          </div>

          <div className="attack-shop card-small">
            <h3>🛒 Tienda</h3>
            <button
              type="button"
              className="shop-btn"
              disabled={!canBuyDefense || shopBusy}
              onClick={handleBuyDefense}
              title={`Defensa (−${DEFENSE_COST} pts)`}
            >
              🛡️ Defensa −{DEFENSE_COST} · {me?.defensesBought || 0}/{MAX_DEFENSE_BUYS}
            </button>
            {Object.values(ATTACK_TYPES).map((type) => {
              const info = ATTACK_LABELS[type];
              const cost = ATTACK_COSTS[type];
              const uses = getAttackUses(me, type);
              const canBuy =
                !finished &&
                canUseAttackType(me, type) &&
                myScore >= cost &&
                !shopBusy;
              return (
                <button
                  key={type}
                  type="button"
                  className="shop-btn"
                  disabled={!canBuy}
                  onClick={() => handleBuyAttack(type)}
                  title={`${info.title} (−${cost} pts)`}
                >
                  {info.icon} {info.title} −{cost} · {uses}/{MAX_ATTACK_USES}
                </button>
              );
            })}
          </div>

          {options.hints && (
            <div className="attack-info card-small">
              <h3>💡 Hints</h3>
              <p>
                −{HINT_COST} pts · {me?.hintsUsed || 0}/{MAX_HINTS} usados
                {!hintCheck.ok ? ` · ${hintCheck.reason}` : ""}
              </p>
            </div>
          )}

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

          <p className={`status-message ${status.type}`}>{status.message}</p>
          <button type="button" className="btn btn-ghost" onClick={leaveRoom}>
            Abandonar
          </button>
        </aside>

        <main className="game-board-area">
          <div className="board-toolbar">
            <BoardSizePicker value={boardSize} onChange={setBoardSize} />
            <GameTools
              showNotes={options.notes}
              showHints={options.hints}
              draftMode={draftMode}
              onToggleDraft={() => setDraftMode((v) => !v)}
              onHint={handleHint}
              hintsUsed={me?.hintsUsed || 0}
              disabled={finished || frozen}
              canHint={canHintNow}
              hintReason={hintCheck.ok ? "" : hintCheck.reason}
            />
          </div>
          {options.notes && draftMode && (
            <p className="draft-banner">Modo notas activo — los dígitos son solo candidatos</p>
          )}
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
              notes={options.notes ? notes : {}}
              conflictCells={conflictCells}
              boardSize={boardSize}
            />
          </div>
          <Numpad
            frozen={frozen || finished}
            draftMode={options.notes && draftMode}
            onInput={handleNumberInput}
            onClear={() => handleNumberInput(0)}
            boardSize={boardSize}
          />
          <p className="keyboard-hint">{shortcuts}</p>
        </main>
      </div>

      {finished && (
        <div className="game-overlay">
          <div className="game-overlay-content">
            <h2>{won ? "¡Victoria!" : "Derrota"}</h2>
            <p>
              {room.battleMode === "score"
                ? won
                  ? `Ganaste por puntos (${myFinal} vs ${oppFinal}). +${diff.winPoints} pts`
                  : `${room.winnerName} ganó por puntos (${oppFinal} vs ${myFinal}). +5 pts por participar`
                : won
                  ? `Resolviste el sudoku primero (${diff.label}). +${diff.winPoints} pts`
                  : `${room.winnerName} resolvió el sudoku primero. +5 pts por participar`}
            </p>
            {options.timer && (
              <p className="overlay-meta">Tiempo: {formatElapsed(elapsed)}</p>
            )}
            {(me?.hintsUsed || opponent?.hintsUsed) ? (
              <p className="overlay-meta">
                Hints: tú {me?.hintsUsed || 0} · rival {opponent?.hintsUsed || 0}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={leaveRoom}>
              Volver al lobby
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
