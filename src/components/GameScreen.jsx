import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { getDifficulty } from "../lib/difficulty";
import {
  ATTACK_TYPES,
  ATTACK_LABELS,
  DEFENSE_COST,
  MAX_DEFENSE_BUYS,
  ATTACK_CREDIT_EVERY,
  ATTACK_REGEN_AMOUNT,
  isInputFrozen,
  getActiveAttacks,
  isCellBlocked,
  getAttackUses,
  canUseAttackType,
  getAttackRegenInfo,
} from "../lib/attacks";
import {
  canUseHint,
  celebrationCells,
  clearCellNotes,
  DEFAULT_BOARD_SIZE,
  formatElapsed,
  getBattleMode,
  getConflictCells,
  HINT_COST,
  MAX_HINTS,
  normalizeGameOptions,
  playerScore,
  POINTS_PER_BLOCK,
  POINTS_PER_HIT,
  POINTS_PER_LINE,
  startedAtMs,
  streakMultiplier,
  toggleNoteValue,
} from "../lib/features";
import {
  DEFAULT_CAPTURE_COLOR,
  ZONE_WIN_THRESHOLD,
  countZonesFor,
  getCaptureColor,
  normalizeZones,
  zoneCellKeys,
} from "../lib/zones";
import {
  SudokuBoard,
  Numpad,
  ScorePanel,
  GameTools,
  TimerDisplay,
  BoardSizePicker,
  MatchHud,
  StreakRail,
  PointsRail,
  ZonesMap,
  getCompletedDigits,
} from "./GameUI";
import { useSudokuKeyboard } from "../hooks/useSudokuKeyboard";

function buildPointsGain(breakdown, id) {
  if (!breakdown?.total) return null;
  const labels = [`+${POINTS_PER_HIT} acierto`];
  if (breakdown.completedRow) labels.push(`+${POINTS_PER_LINE} fila`);
  if (breakdown.completedCol) labels.push(`+${POINTS_PER_LINE} columna`);
  if (breakdown.completedBox) labels.push(`+${POINTS_PER_BLOCK} bloque`);
  if (breakdown.mult > 1) labels.push(`×${breakdown.mult} racha`);
  return { id, total: breakdown.total, labels };
}

export function GameScreen() {
  const { user } = useAuth();
  const { room, gameService, leaveRoom, getOpponent, getMe } = useGame();

  const [selectedCell, setSelectedCell] = useState(null);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [wrongCell, setWrongCell] = useState(null);
  const [tick, setTick] = useState(0);
  const [draftMode, setDraftMode] = useState(false);
  const [notes, setNotes] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);
  const [shopBusy, setShopBusy] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [pointsGain, setPointsGain] = useState(null);
  const [celebrateCells, setCelebrateCells] = useState(null);

  const options = normalizeGameOptions(room?.options, room?.battleMode);
  const hintsEnabled = Boolean(options.hints) && room?.battleMode !== "zones";
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
  const boardDone = Boolean(me?.boardCompleted);
  const isZones = room?.battleMode === "zones";
  const waitingForOpponent =
    (room?.battleMode === "score" || isZones) && boardDone && !finished;
  const inputLocked = frozen || finished || boardDone;
  const zones = normalizeZones(room?.zones);
  const myZones = user ? countZonesFor(zones, user.uid) : 0;
  const oppZones = opponent ? countZonesFor(zones, opponent.uid) : 0;
  const myCapture = getCaptureColor(me?.captureColor || DEFAULT_CAPTURE_COLOR);
  const oppCapture = getCaptureColor(opponent?.captureColor || DEFAULT_CAPTURE_COLOR);
  const myStreak = me?.streak || 0;
  const myStreakMult = streakMultiplier(myStreak);

  const zoneTints = useMemo(() => {
    if (!isZones || !user) return null;
    const map = new Map();
    for (let i = 0; i < 9; i++) {
      if (zones[i] !== user.uid) continue;
      for (const key of zoneCellKeys(i)) map.set(key, myCapture.hex);
    }
    return map;
  }, [isZones, user, zones, myCapture.hex]);

  const conflictCells = useMemo(() => {
    if (!options.conflicts || !myBoard || !room?.puzzle) return null;
    return getConflictCells(myBoard, room.puzzle);
  }, [options.conflicts, myBoard, room?.puzzle]);

  const handleNumberInput = useCallback(async (value, cellOverride = null) => {
    const cell = cellOverride || selectedCell;
    if (!cell || !room || !user || frozen || boardDone) return;
    const { row, col } = cell;
    if (room.puzzle[row][col] !== 0) return;

    if (options.notes && draftMode) {
      if (myBoard?.[row]?.[col]) return;
      setSelectedCell(cell);
      setNotes((prev) => toggleNoteValue(prev, row, col, value));
      return;
    }

    try {
      setSelectedCell(cell);
      setStatus({ message: "", type: "" });
      const result = await gameService.placeNumber(room.id, row, col, value);

      if (result.streakBroken) {
        setMistakes((n) => n + 1);
        setStatus({ message: "Número incorrecto — racha reiniciada", type: "error" });
        setWrongCell({ row, col });
        setTimeout(() => setWrongCell(null), 500);
        return;
      }

      setNotes((prev) => clearCellNotes(prev, row, col));
      if (result.waitingForOpponent) {
        setStatus({
          message: "¡Tablero completo! Esperando a que el rival termine…",
          type: "",
        });
      } else if (result.wasCorrect) {
        const breakdown = result.pointsBreakdown;
        const parts = [];
        if (result.pointsEarned > 0) parts.push(`+${result.pointsEarned} pts`);
        if (breakdown?.completedRow) parts.push(`fila +${POINTS_PER_LINE}`);
        if (breakdown?.completedCol) parts.push(`columna +${POINTS_PER_LINE}`);
        if (breakdown?.completedBox) parts.push(`bloque +${POINTS_PER_BLOCK}`);
        if (result.zoneCaptured != null) {
          parts.push(`zona capturada (${result.zonesOwned}/${ZONE_WIN_THRESHOLD})`);
        }
        if (result.streak >= 5) {
          parts.push(`racha ×${streakMultiplier(result.streak)}`);
        }
        if (result.attackCreditEarned) {
          parts.push(`crédito de ataque listo`);
        }
        if (parts.length > 0) {
          setStatus({ message: parts.join(" · "), type: "success" });
        }

        if (result.pointsEarned > 0) {
          const burstId = `${Date.now()}-${result.pointsEarned}`;
          const details = breakdown || {
            total: result.pointsEarned,
            mult: streakMultiplier(result.streak || 0),
            completedRow: false,
            completedCol: false,
            completedBox: false,
          };
          setPointsGain(buildPointsGain(details, burstId));
          const cells = celebrationCells(row, col, details);
          if (cells.size > 0) {
            setCelebrateCells(cells);
            setTimeout(() => setCelebrateCells(null), 900);
          }
          setTimeout(() => setPointsGain(null), 1600);
        }
      }
    } catch (err) {
      const msg = err.message || "";
      if (/incorrecto/i.test(msg)) setMistakes((n) => n + 1);
      setStatus({ message: msg, type: "error" });
      setWrongCell({ row, col });
      setTimeout(() => setWrongCell(null), 500);
    }
  }, [selectedCell, room, user, frozen, boardDone, options.notes, draftMode, myBoard, gameService]);

  const handleJoystickInput = useCallback(
    (row, col, value) => {
      handleNumberInput(value, { row, col });
    },
    [handleNumberInput]
  );

  const handleSelectCell = useCallback((row, col) => {
    if (!room || !user) return;
    if (isCellBlocked(attacks, user.uid, row, col)) return;
    setSelectedCell({ row, col });
  }, [room, user, attacks]);

  const handleHint = useCallback(async () => {
    if (!hintsEnabled || !selectedCell || !room || !user || frozen || finished || boardDone) return;
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
        message: result.waitingForOpponent
          ? "¡Tablero completo! Esperando a que el rival termine…"
          : `Hint usado (−${result.cost} pts). Quedan ${MAX_HINTS - (result.hintsUsed || 0)}`,
        type: "",
      });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }, [hintsEnabled, selectedCell, room, user, frozen, finished, boardDone, me, gameService]);

  useEffect(() => {
    if (!waitingForOpponent) return;
    setStatus({
      message: "¡Tablero completo! Esperando a que el rival termine…",
      type: "",
    });
  }, [waitingForOpponent]);

  const handleBuyDefense = useCallback(async () => {
    if (!room || finished || boardDone || shopBusy) return;
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
  }, [room, finished, boardDone, shopBusy, gameService]);

  const handleAddAttack = useCallback(async (type) => {
    if (!room || finished || boardDone || shopBusy) return;
    try {
      setShopBusy(true);
      const result = await gameService.addAttack(room.id, type);
      setStatus({
        message: result.absorbed
          ? `${result.label} agregado pero bloqueado por defensa`
          : `${result.label} lanzado`,
        type: "",
      });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setShopBusy(false);
    }
  }, [room, finished, boardDone, shopBusy, gameService]);

  useSudokuKeyboard({
    enabled: Boolean(room && user && !finished && !frozen && !boardDone),
    selectedCell,
    onSelectCell: handleSelectCell,
    onInput: handleNumberInput,
    onClear: () => handleNumberInput(0),
    onToggleDraft: options.notes ? () => setDraftMode((v) => !v) : undefined,
    onHint: hintsEnabled ? handleHint : undefined,
    notesEnabled: options.notes,
    hintsEnabled,
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
    if (blocked) return;
    setSelectedCell({ row, col });
  };

  void tick;

  const myFinal = playerScore(me);
  const oppFinal = playerScore(opponent);
  const hintCheck = canUseHint(me);
  const canHintNow = Boolean(selectedCell) && hintCheck.ok && hintsEnabled;
  const attackRegen = getAttackRegenInfo(room.startedAt);
  const attackLimit = attackRegen.limit;
  const myLeadValue = isZones
    ? myZones
    : room.battleMode === "score"
      ? myScore
      : me?.solvedCount || 0;
  const oppLeadValue = isZones
    ? oppZones
    : room.battleMode === "score"
      ? playerScore(opponent)
      : opponent?.solvedCount || 0;
  const iLead = myLeadValue > oppLeadValue;
  const oppLeads = oppLeadValue > myLeadValue;
  const canBuyDefense =
    !finished &&
    !boardDone &&
    (me?.defensesBought || 0) < MAX_DEFENSE_BUYS &&
    myScore >= DEFENSE_COST;
  const attackCredits = me?.attackCredits || 0;

  const shortcuts = [
    "1-9",
    "0/Supr borrar",
    options.notes && "P notas",
    hintsEnabled && "H hint",
    "flechas",
  ]
    .filter(Boolean)
    .join(" · ");

  const totalEmpty = room.puzzle.flat().filter((c) => c === 0).length;
  const oppName = opponent?.name?.split(" ")[0] || "Rival";
  const completedDigits = useMemo(
    () => getCompletedDigits(myBoard, room.puzzle),
    [myBoard, room.puzzle]
  );

  const regenLabel = (() => {
    const m = Math.floor(attackRegen.nextInSec / 60);
    const s = attackRegen.nextInSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  })();

  const combatPanel = (
    <div className="attack-info card-small combat-panel">
      <h3>⚔️ Combate</h3>
      <p>
        Cada {ATTACK_CREDIT_EVERY} aciertos ganas 1 crédito para agregar un ataque a elección
        (se lanza al agregarlo). Cada 3 min +{ATTACK_REGEN_AMOUNT} usos por tipo.
      </p>
      <ul>
        <li><strong>Congelar</strong> — 4 seg</li>
        <li><strong>Bloquear línea</strong> — 10 seg</li>
        <li><strong>Bloquear celda</strong> — 10 seg</li>
      </ul>
      <p className="shop-meta attack-regen-meta">
        Créditos {attackCredits} · Límite {attackLimit}/tipo · +{ATTACK_REGEN_AMOUNT} en {regenLabel}
      </p>
      <p className="shop-meta">
        Racha {myStreak}
        {myStreakMult > 1 ? ` (×${myStreakMult})` : ""}
        {" · "}Escudos: {me?.defenseCharges || 0}
        {" · "}Usos: ❄️{getAttackUses(me, ATTACK_TYPES.FREEZE_INPUT)}/{attackLimit}
        {" · "}➖{getAttackUses(me, ATTACK_TYPES.BLOCK_LINE)}/{attackLimit}
        {" · "}🚫{getAttackUses(me, ATTACK_TYPES.BLOCK_CELL)}/{attackLimit}
      </p>
    </div>
  );

  const shopPanel = (
    <div className="attack-shop card-small shop-panel">
      <h3>🛒 Ataques y defensa</h3>
      <p className="shop-meta">
        Créditos de ataque: <strong>{attackCredits}</strong>
        {attackCredits < 1
          ? ` · consigue 1 cada ${ATTACK_CREDIT_EVERY} aciertos`
          : " · elige un ataque para lanzarlo"}
      </p>
      <div className="shop-row">
        <div className="shop-item-info">
          <span className="shop-item-title">🛡️ Defensa</span>
          <span className="shop-item-meta">
            −{DEFENSE_COST} pts · {me?.defensesBought || 0}/{MAX_DEFENSE_BUYS}
          </span>
        </div>
        <button
          type="button"
          className="shop-buy-btn"
          disabled={!canBuyDefense || shopBusy}
          onClick={handleBuyDefense}
          title={`Comprar defensa (−${DEFENSE_COST} pts)`}
        >
          Comprar
        </button>
      </div>
      {Object.values(ATTACK_TYPES).map((type) => {
        const info = ATTACK_LABELS[type];
        const uses = getAttackUses(me, type);
        const canAdd =
          !finished &&
          !boardDone &&
          !opponent?.boardCompleted &&
          canUseAttackType(me, type, attackLimit) &&
          attackCredits >= 1 &&
          !shopBusy;
        return (
          <div key={type} className="shop-row">
            <div className="shop-item-info">
              <span className="shop-item-title">
                {info.icon} {info.title}
              </span>
              <span className="shop-item-meta">
                1 crédito · {uses}/{attackLimit}
              </span>
            </div>
            <button
              type="button"
              className="shop-buy-btn"
              disabled={!canAdd}
              onClick={() => handleAddAttack(type)}
              title={`Agregar ${info.title} (1 crédito)`}
            >
              Agregar
            </button>
          </div>
        );
      })}
    </div>
  );

  const hintsPanel = hintsEnabled ? (
    <div className="attack-info card-small">
      <h3>💡 Hints</h3>
      <p>
        −{HINT_COST} pts · {me?.hintsUsed || 0}/{MAX_HINTS} usados
        {!hintCheck.ok ? ` · ${hintCheck.reason}` : ""}
      </p>
    </div>
  ) : null;

  const extrasBlock = (
    <>
      {combatPanel}
      {shopPanel}
      {hintsPanel}
    </>
  );

  return (
    <section className="screen active game-screen">
      <div className="game-layout game-layout-versus">
        <main className="game-board-area">
          <div className="versus-top-bar desktop-versus-top">
            <button
              type="button"
              className="btn btn-ghost versus-leave-btn"
              onClick={leaveRoom}
            >
              Abandonar
            </button>
            <div className="versus-score-stack">
              {options.timer && <TimerDisplay seconds={elapsed} compact />}
              <ScorePanel
                me={me}
                opponent={opponent}
                battleMode={room.battleMode || "race"}
                mistakes={mistakes}
                myZones={myZones}
                oppZones={oppZones}
              />
            </div>
          </div>

          <MatchHud
            showTimer={options.timer}
            elapsed={elapsed}
            myProgress={me?.solvedCount || 0}
            oppProgress={opponent?.solvedCount ?? 0}
            totalEmpty={totalEmpty}
            mistakes={mistakes}
            myScore={myScore}
            activeAttacks={activeAttacks}
            defenseCharges={me?.defenseCharges || 0}
            opponentName={oppName}
            attackRegen={attackRegen}
            iLead={iLead}
            oppLeads={oppLeads}
          />

          <div className="board-toolbar">
            <BoardSizePicker value={boardSize} onChange={setBoardSize} />
            <GameTools
              showNotes={options.notes}
              showHints={hintsEnabled}
              draftMode={draftMode}
              onToggleDraft={() => setDraftMode((v) => !v)}
              onHint={handleHint}
              hintsUsed={me?.hintsUsed || 0}
              disabled={inputLocked}
              canHint={canHintNow}
              hintReason={hintCheck.ok ? "" : hintCheck.reason}
            />
          </div>
          {waitingForOpponent && (
            <p className="waiting-banner-inline">
              ¡Completaste! Esperando a {oppName} para cerrar
              {isZones ? " por zonas" : " por puntos"}…
            </p>
          )}
          {(room.battleMode === "score" || isZones) &&
            opponent?.boardCompleted &&
            !finished &&
            !boardDone && (
            <p className="waiting-banner-inline rival">
              {oppName} ya terminó — completa tu tablero
            </p>
          )}
          {options.notes && draftMode && (
            <p className="draft-banner">Modo notas activo — los dígitos son solo candidatos</p>
          )}
          <div className="board-stage">
            <aside className="board-left-rail">
              <StreakRail streak={myStreak} multiplier={myStreakMult} />
              <PointsRail pointsGain={pointsGain} />
              {isZones && (
                <ZonesMap
                  zones={zones}
                  meUid={user.uid}
                  oppUid={opponent?.uid}
                  myColor={myCapture.hex}
                  oppColor={oppCapture.hex}
                  threshold={ZONE_WIN_THRESHOLD}
                />
              )}
            </aside>
            <div className="board-wrapper">
              {frozen && !boardDone && (
                <div className="frozen-overlay">
                  <span>❄️ Entrada congelada</span>
                </div>
              )}
              {waitingForOpponent && (
                <div className="frozen-overlay waiting-overlay">
                  <span>⏳ Esperando al rival</span>
                </div>
              )}
              <SudokuBoard
                board={myBoard}
                puzzle={room.puzzle}
                attacks={attacks}
                playerId={user.uid}
                selectedCell={selectedCell}
                onCellClick={handleCellClick}
                onJoystickInput={handleJoystickInput}
                joystickEnabled={!inputLocked}
                draftMode={options.notes && draftMode}
                wrongCell={wrongCell}
                notes={options.notes ? notes : {}}
                conflictCells={conflictCells}
                celebrateCells={celebrateCells}
                zoneTints={zoneTints}
                boardSize={boardSize}
              />
            </div>
          </div>
          <Numpad
            frozen={inputLocked}
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
              {extrasOpen ? "▾" : "▸"} Tienda y combate
              {attackCredits > 0 ? ` · ⚔️${attackCredits}` : ""}
              {(me?.defenseCharges || 0) > 0 ? ` · 🛡️${me.defenseCharges}` : ""}
            </button>
            {extrasOpen && <div className="mobile-extras-body">{extrasBlock}</div>}
            <button type="button" className="btn btn-ghost mobile-leave" onClick={leaveRoom}>
              Abandonar
            </button>
          </div>
        </main>

        <aside className="game-sidebar desktop-sidebar">
          <div className="game-badges">
            <div className="difficulty-badge-game">{diff.icon} {diff.label}</div>
            <div className="difficulty-badge-game">{battle.icon} {battle.label}</div>
          </div>

          {waitingForOpponent && (
            <div className="waiting-banner card-small">
              <strong>¡Completaste tu sudoku!</strong>
              <p>
                Esperando a que {oppName} termine para definir el ganador
                {isZones ? " por zonas" : " por puntos"}.
              </p>
            </div>
          )}
          {(room.battleMode === "score" || isZones) &&
            opponent?.boardCompleted &&
            !finished &&
            !boardDone && (
            <div className="waiting-banner rival-done card-small">
              <strong>{oppName} ya terminó</strong>
              <p>Completa tu tablero para cerrar la ronda.</p>
            </div>
          )}

          {isZones && (
            <div className="zones-legend card-small">
              <p>
                <span className="zones-swatch" style={{ background: myCapture.hex }} /> Tú ·{" "}
                <span className="zones-swatch" style={{ background: oppCapture.hex }} /> {oppName}
              </p>
              <p className="shop-meta">
                Zonas {myZones}–{oppZones} · meta {ZONE_WIN_THRESHOLD}
              </p>
            </div>
          )}

          {combatPanel}
          {shopPanel}
          {hintsPanel}

          {activeAttacks.length > 0 && (
            <div className="attack-banner desktop-only-banner">
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
        </aside>
      </div>

      {finished && (
        <div className="game-overlay">
          <div className="game-overlay-content">
            <h2>{won ? "¡Victoria!" : "Derrota"}</h2>
            <p>
              {room.battleMode === "zones"
                ? won
                  ? `Ganaste la guerra de zonas (${myZones}–${oppZones}). +${diff.winPoints} pts`
                  : `${room.winnerName} ganó por zonas (${oppZones}–${myZones}). +5 pts por participar`
                : room.battleMode === "score"
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
            {hintsEnabled && (me?.hintsUsed || opponent?.hintsUsed) ? (
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
