import {
  generateSudoku,
  isBoardComplete,
  flattenGrid,
  ensureGrid,
  flattenBoards,
  unflattenBoards,
} from "./sudoku";
import { createAttack, pruneExpiredAttacks, emptyAttackUses, pickRandomAttackType, pickRandomAttackTarget, resolveIncomingAttack, incrementAttackUse, canUseAttackType, ATTACK_COSTS, DEFENSE_COST, MAX_DEFENSE_BUYS, MAX_ATTACK_USES, ATTACK_LABELS } from "./attacks";
import { getCurrentUser, getUserDisplayName } from "./auth";
import { getDifficulty, DEFAULT_DIFFICULTY } from "./difficulty";
import {
  DEFAULT_BATTLE_MODE,
  getBattleMode,
  HINT_COST,
  canUseHint,
  normalizeGameOptions,
  playerScore,
} from "./features";
import { db, firebase } from "./firebase";

const MAX_PLAYERS = 2;
const ROOMS = "rooms";
const ROOM_CODES = "roomCodes";
const { FieldValue } = firebase.firestore;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function playerPayload(user) {
  return {
    uid: user.uid,
    name: getUserDisplayName(user),
    email: user.email || "",
    photoURL: user.photoURL || "",
    solvedCount: 0,
    hintsUsed: 0,
    pointsSpent: 0,
    defenseCharges: 0,
    defensesBought: 0,
    attackUses: emptyAttackUses(),
  };
}

function emptyPlayerBoard(puzzle) {
  const grid = ensureGrid(puzzle);
  return grid.map((row) => row.map((cell) => (cell === 0 ? 0 : cell)));
}

function parseRoomData(data) {
  return {
    ...data,
    puzzle: ensureGrid(data.puzzle),
    solution: ensureGrid(data.solution),
    boards: unflattenBoards(data.boards),
  };
}

function markPlayerBoardCompleted(players, uid) {
  return players.map((p) =>
    p.uid === uid
      ? {
          ...p,
          boardCompleted: true,
          completedAt: p.completedAt || Date.now(),
        }
      : p
  );
}

function allPlayersBoardCompleted(players) {
  return (
    Array.isArray(players) &&
    players.length >= 2 &&
    players.every((p) => p.boardCompleted)
  );
}

function resolveWinner(players, completerUid, battleMode) {
  if (battleMode === "score") {
    const ranked = [...players].sort((a, b) => {
      const scoreDiff = playerScore(b) - playerScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      const aTime = a.completedAt || Number.POSITIVE_INFINITY;
      const bTime = b.completedAt || Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return (a.hintsUsed || 0) - (b.hintsUsed || 0);
    });
    const top = ranked[0];
    return { winner: top.uid, winnerName: top.name };
  }

  const completer = players.find((p) => p.uid === completerUid);
  return {
    winner: completerUid,
    winnerName: completer?.name || "Jugador",
  };
}

/** Ends race immediately; score waits until every player finished their board. */
function applyBoardCompletion(updates, players, board, solution, puzzle, battleMode, completerUid) {
  if (!isBoardComplete(board, solution, puzzle)) {
    return { players, matchFinished: false, waitingForOpponent: false };
  }

  let nextPlayers = markPlayerBoardCompleted(players, completerUid);
  updates.players = nextPlayers;

  if (battleMode === "score") {
    if (!allPlayersBoardCompleted(nextPlayers)) {
      return { players: nextPlayers, matchFinished: false, waitingForOpponent: true };
    }
  }

  const result = resolveWinner(nextPlayers, completerUid, battleMode || "race");
  updates.winner = result.winner;
  updates.winnerName = result.winnerName;
  updates.status = "finished";
  updates.finishedAt = FieldValue.serverTimestamp();
  updates.finishedBy = completerUid;
  return { players: nextPlayers, matchFinished: true, waitingForOpponent: false };
}

export class GameService {
  constructor() {
    this.db = db;
    this.unsubscribe = null;
    this.roomId = null;
  }

  async createRoom(
    difficultyId = DEFAULT_DIFFICULTY,
    battleModeId = DEFAULT_BATTLE_MODE,
    options = {}
  ) {
    const user = getCurrentUser();
    if (!user) throw new Error("Debes iniciar sesi?n");

    const difficulty = getDifficulty(difficultyId);
    const battleMode = getBattleMode(battleModeId);
    const gameOptions = normalizeGameOptions(options);
    const { puzzle, solution } = generateSudoku(difficulty.cellsToRemove);
    const code = generateRoomCode();

    const roomData = {
      code,
      hostId: user.uid,
      status: "waiting",
      maxPlayers: MAX_PLAYERS,
      difficulty: difficulty.id,
      difficultyLabel: difficulty.label,
      battleMode: battleMode.id,
      battleModeLabel: battleMode.label,
      options: gameOptions,
      playerUids: [user.uid],
      players: [playerPayload(user)],
      puzzle: flattenGrid(puzzle),
      solution: flattenGrid(solution),
      rankingProcessed: [],
      headToHeadRecorded: false,
      boards: flattenBoards({ [user.uid]: emptyPlayerBoard(puzzle) }),
      lastMoves: {},
      attacks: [],
      winner: null,
      winnerName: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await this.db.collection(ROOMS).add(roomData);
    await this.db.collection(ROOM_CODES).doc(code).set({
      roomId: docRef.id,
      status: "waiting",
      hostId: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    this.roomId = docRef.id;
    return { roomId: docRef.id, code };
  }

  async joinRoom(code) {
    const user = getCurrentUser();
    if (!user) throw new Error("Debes iniciar sesi?n");

    const roomCode = code.toUpperCase().trim();
    const codeRef = this.db.collection(ROOM_CODES).doc(roomCode);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      throw new Error("Sala no encontrada o ya en partida");
    }

    const { roomId, status: codeStatus } = codeDoc.data();
    if (codeStatus !== "waiting") {
      throw new Error("Sala no encontrada o ya en partida");
    }

    const roomRef = this.db.collection(ROOMS).doc(roomId);

    return this.db.runTransaction(async (tx) => {
      const roomSnap = await tx.get(roomRef);
      if (!roomSnap.exists) {
        throw new Error("Sala no encontrada o ya en partida");
      }

      const data = parseRoomData(roomSnap.data());

      if (data.status !== "waiting") {
        throw new Error("Sala no encontrada o ya en partida");
      }

      if (data.players.length >= MAX_PLAYERS) {
        throw new Error("La sala est? llena (m?ximo 2 jugadores)");
      }

      if (data.players.some((p) => p.uid === user.uid)) {
        return { roomId, code: data.code };
      }

      const updatedPlayers = [...data.players, playerPayload(user)];
      const boards = {
        ...data.boards,
        [user.uid]: emptyPlayerBoard(data.puzzle),
      };

      tx.update(roomRef, {
        players: updatedPlayers,
        playerUids: updatedPlayers.map((p) => p.uid),
        boards: flattenBoards(boards),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { roomId, code: data.code };
    }).then((result) => {
      this.roomId = result.roomId;
      return result;
    });
  }

  async startGame(roomId) {
    const user = getCurrentUser();
    const docRef = this.db.collection(ROOMS).doc(roomId);
    const doc = await docRef.get();
    const data = doc.data();

    if (!data) throw new Error("Sala no encontrada");
    if (data.hostId !== user.uid) throw new Error("Solo el anfitri?n puede iniciar");
    if (data.players.length < 2) throw new Error("Se necesitan 2 jugadores");

    await docRef.update({
      status: "playing",
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (data.code) {
      await this.db.collection(ROOM_CODES).doc(data.code).update({ status: "playing" });
    }
  }

  listenRoom(roomId, callback) {
    this.roomId = roomId;
    if (this.unsubscribe) this.unsubscribe();

    this.unsubscribe = this.db
      .collection(ROOMS)
      .doc(roomId)
      .onSnapshot((snap) => {
        if (snap.exists) {
          const data = parseRoomData(snap.data());
          data.attacks = pruneExpiredAttacks(data.attacks);
          callback({ id: snap.id, ...data });
        }
      });
  }

  stopListening() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  async placeNumber(roomId, row, col, value) {
    const user = getCurrentUser();
    const docRef = this.db.collection(ROOMS).doc(roomId);

    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Sala no encontrada");

      const data = parseRoomData(doc.data());
      if (data.status !== "playing") throw new Error("La partida no est? activa");
      if (data.winner) throw new Error("La partida ya termin?");

      const mePlayer = data.players.find((p) => p.uid === user.uid);
      if (mePlayer?.boardCompleted) {
        throw new Error("Ya completaste tu tablero. Espera al rival.");
      }

      const puzzle = data.puzzle;
      const solution = data.solution;
      const boards = { ...data.boards };
      const board = boards[user.uid].map((r) => [...r]);

      if (puzzle[row][col] !== 0) throw new Error("Celda fija");
      if (value !== 0 && value !== solution[row][col]) {
        throw new Error("N?mero incorrecto");
      }

      const previous = board[row][col];
      board[row][col] = value;
      boards[user.uid] = board;

      const wasCorrect =
        value !== 0 && value === solution[row][col] && previous !== value;
      const wasCleared =
        value === 0 && previous !== 0 && previous === solution[row][col];

      let players = data.players.map((p) => ({
        ...p,
        attackUses: { ...emptyAttackUses(), ...(p.attackUses || {}) },
      }));

      if (wasCorrect) {
        players = players.map((p) =>
          p.uid === user.uid ? { ...p, solvedCount: (p.solvedCount || 0) + 1 } : p
        );
      } else if (wasCleared) {
        players = players.map((p) =>
          p.uid === user.uid
            ? { ...p, solvedCount: Math.max(0, (p.solvedCount || 0) - 1) }
            : p
        );
      }

      let attacks = pruneExpiredAttacks(data.attacks);
      let autoAttack = null;
      let autoAttackAbsorbed = false;

      if (wasCorrect) {
        const me = players.find((p) => p.uid === user.uid);
        const opponent = players.find((p) => p.uid !== user.uid);
        const attackType = pickRandomAttackType(me);

        if (opponent && !opponent.boardCompleted && attackType) {
          const { targetRow, targetCol } = pickRandomAttackTarget(
            attackType,
            boards[opponent.uid],
            puzzle
          );
          const attack = createAttack(
            attackType,
            opponent.uid,
            user.uid,
            targetRow,
            targetCol
          );
          const resolved = resolveIncomingAttack(players, attacks, attack);
          players = resolved.players.map((p) =>
            p.uid === user.uid
              ? { ...p, attackUses: incrementAttackUse(p, attackType) }
              : p
          );
          attacks = resolved.attacks;
          autoAttack = {
            type: attackType,
            label: ATTACK_LABELS[attackType]?.title || attackType,
          };
          autoAttackAbsorbed = resolved.absorbed;
        }
      }

      const lastMoves = { ...(data.lastMoves || {}) };
      lastMoves[user.uid] = { row, col, previous, value, fromHint: false };

      const updates = {
        boards: flattenBoards(boards),
        players,
        lastMoves,
        attacks,
        updatedAt: FieldValue.serverTimestamp(),
      };

      const completion = applyBoardCompletion(
        updates,
        players,
        board,
        solution,
        puzzle,
        data.battleMode || "race",
        user.uid
      );

      tx.update(docRef, updates);
      return {
        wasCorrect,
        winner: updates.winner === user.uid,
        fromHint: false,
        autoAttack,
        autoAttackAbsorbed,
        waitingForOpponent: completion.waitingForOpponent,
        boardCompleted: Boolean(completion.players.find((p) => p.uid === user.uid)?.boardCompleted),
      };
    });
  }

  async useHint(roomId, row, col) {
    const user = getCurrentUser();
    const docRef = this.db.collection(ROOMS).doc(roomId);

    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Sala no encontrada");

      const data = parseRoomData(doc.data());
      if (data.status !== "playing") throw new Error("La partida no est? activa");
      if (data.winner) throw new Error("La partida ya termin?");

      const me = data.players.find((p) => p.uid === user.uid);
      if (me?.boardCompleted) {
        throw new Error("Ya completaste tu tablero. Espera al rival.");
      }

      const puzzle = data.puzzle;
      const solution = data.solution;
      const boards = { ...data.boards };
      const board = boards[user.uid].map((r) => [...r]);

      if (puzzle[row][col] !== 0) throw new Error("Celda fija");
      if (board[row][col] === solution[row][col]) {
        throw new Error("Esa celda ya est? resuelta");
      }

      const hintCheck = canUseHint(me);
      if (!hintCheck.ok) throw new Error(hintCheck.reason);

      const previous = board[row][col];
      const value = solution[row][col];
      board[row][col] = value;
      boards[user.uid] = board;

      const players = data.players.map((p) =>
        p.uid === user.uid
          ? {
              ...p,
              solvedCount: (p.solvedCount || 0) + (previous === value ? 0 : 1),
              hintsUsed: (p.hintsUsed || 0) + 1,
            }
          : { ...p }
      );

      const lastMoves = { ...(data.lastMoves || {}) };
      lastMoves[user.uid] = { row, col, previous, value, fromHint: true };

      const updates = {
        boards: flattenBoards(boards),
        players,
        lastMoves,
        attacks: pruneExpiredAttacks(data.attacks),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const completion = applyBoardCompletion(
        updates,
        players,
        board,
        solution,
        puzzle,
        data.battleMode || "race",
        user.uid
      );

      tx.update(docRef, updates);
      return {
        value,
        cost: HINT_COST,
        hintsUsed: (me?.hintsUsed || 0) + 1,
        winner: updates.winner === user.uid,
        waitingForOpponent: completion.waitingForOpponent,
        boardCompleted: Boolean(completion.players.find((p) => p.uid === user.uid)?.boardCompleted),
      };
    });
  }

  async undoLastMove(roomId) {
    const user = getCurrentUser();
    const docRef = this.db.collection(ROOMS).doc(roomId);

    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Sala no encontrada");

      const data = parseRoomData(doc.data());
      if (data.status !== "playing") throw new Error("La partida no est? activa");
      if (data.winner) throw new Error("La partida ya termin?");

      const mePlayer = data.players.find((p) => p.uid === user.uid);
      if (mePlayer?.boardCompleted) {
        throw new Error("Ya completaste tu tablero. Espera al rival.");
      }

      const lastMove = data.lastMoves?.[user.uid];
      if (!lastMove) throw new Error("No hay movimiento para deshacer");

      const { row, col, previous, value, fromHint } = lastMove;
      const boards = { ...data.boards };
      const board = boards[user.uid].map((r) => [...r]);

      if (board[row][col] !== value) {
        throw new Error("No hay movimiento para deshacer");
      }

      board[row][col] = previous;
      boards[user.uid] = board;

      const solution = data.solution;
      const wasCorrect = value !== 0 && value === solution[row][col] && previous !== value;
      const wasCleared =
        value === 0 && previous !== 0 && previous === solution[row][col];

      let players = data.players.map((p) => ({ ...p }));
      if (wasCorrect) {
        players = players.map((p) =>
          p.uid === user.uid
            ? {
                ...p,
                solvedCount: Math.max(0, (p.solvedCount || 0) - 1),
                hintsUsed: fromHint
                  ? Math.max(0, (p.hintsUsed || 0) - 1)
                  : p.hintsUsed || 0,
              }
            : p
        );
      } else if (wasCleared) {
        players = players.map((p) =>
          p.uid === user.uid ? { ...p, solvedCount: (p.solvedCount || 0) + 1 } : p
        );
      }

      const lastMoves = { ...(data.lastMoves || {}) };
      delete lastMoves[user.uid];

      tx.update(docRef, {
        boards: flattenBoards(boards),
        players,
        lastMoves,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { row, col, previous };
    });
  }

  async launchAttack(roomId, attackType, targetRow = null, targetCol = null, { paid = false } = {}) {
    const user = getCurrentUser();
    const docRef = this.db.collection(ROOMS).doc(roomId);

    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Sala no encontrada");

      const data = parseRoomData(doc.data());
      if (data.status !== "playing") throw new Error("La partida no est? activa");
      if (data.winner) throw new Error("La partida ya termin?");

      let players = data.players.map((p) => ({
        ...p,
        attackUses: { ...emptyAttackUses(), ...(p.attackUses || {}) },
      }));
      const me = players.find((p) => p.uid === user.uid);
      const opponent = players.find((p) => p.uid !== user.uid);
      if (!me || !opponent) throw new Error("No hay oponente");
      if (me.boardCompleted) {
        throw new Error("Ya completaste tu tablero. Espera al rival.");
      }
      if (opponent.boardCompleted) {
        throw new Error("El rival ya terminó su tablero");
      }

      if (!canUseAttackType(me, attackType)) {
        throw new Error(`M?ximo ${MAX_ATTACK_USES} usos de este ataque`);
      }

      const cost = paid ? ATTACK_COSTS[attackType] || 0 : 0;
      if (paid) {
        if (!cost) throw new Error("Ataque no disponible");
        if (playerScore(me) < cost) {
          throw new Error(`Necesitas ${cost} pts para este ataque`);
        }
      }

      let row = targetRow;
      let col = targetCol;
      if (row == null && col == null) {
        const target = pickRandomAttackTarget(
          attackType,
          data.boards[opponent.uid],
          data.puzzle
        );
        row = target.targetRow;
        col = target.targetCol;
      }

      const attack = createAttack(attackType, opponent.uid, user.uid, row, col);
      let attacks = pruneExpiredAttacks(data.attacks);
      const resolved = resolveIncomingAttack(players, attacks, attack);
      players = resolved.players.map((p) => {
        if (p.uid !== user.uid) return p;
        return {
          ...p,
          attackUses: incrementAttackUse(p, attackType),
          pointsSpent: (p.pointsSpent || 0) + cost,
        };
      });
      attacks = resolved.attacks;

      tx.update(docRef, {
        players,
        attacks,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        attack,
        absorbed: resolved.absorbed,
        cost,
        label: ATTACK_LABELS[attackType]?.title || attackType,
      };
    });
  }

  async buyDefense(roomId) {
    const user = getCurrentUser();
    const docRef = this.db.collection(ROOMS).doc(roomId);

    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Sala no encontrada");

      const data = parseRoomData(doc.data());
      if (data.status !== "playing") throw new Error("La partida no est? activa");
      if (data.winner) throw new Error("La partida ya termin?");

      const me = data.players.find((p) => p.uid === user.uid);
      if (!me) throw new Error("Jugador no encontrado");
      if (me.boardCompleted) {
        throw new Error("Ya completaste tu tablero. Espera al rival.");
      }

      if ((me.defensesBought || 0) >= MAX_DEFENSE_BUYS) {
        throw new Error(`M?ximo ${MAX_DEFENSE_BUYS} defensas por partida`);
      }
      if (playerScore(me) < DEFENSE_COST) {
        throw new Error(`Necesitas ${DEFENSE_COST} pts para comprar defensa`);
      }

      const players = data.players.map((p) =>
        p.uid === user.uid
          ? {
              ...p,
              defensesBought: (p.defensesBought || 0) + 1,
              defenseCharges: (p.defenseCharges || 0) + 1,
              pointsSpent: (p.pointsSpent || 0) + DEFENSE_COST,
            }
          : p
      );

      tx.update(docRef, {
        players,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        cost: DEFENSE_COST,
        defenseCharges: (me.defenseCharges || 0) + 1,
        defensesBought: (me.defensesBought || 0) + 1,
      };
    });
  }

  async buyAttack(roomId, attackType) {
    return this.launchAttack(roomId, attackType, null, null, { paid: true });
  }

  async leaveRoom(roomId) {
    const user = getCurrentUser();
    if (!user || !roomId) return;

    const docRef = this.db.collection(ROOMS).doc(roomId);
    const doc = await docRef.get();
    if (!doc.exists) return;

    const data = parseRoomData(doc.data());
    const players = data.players.filter((p) => p.uid !== user.uid);

    if (players.length === 0) {
      await docRef.delete();
      if (data.code) {
        await this.db.collection(ROOM_CODES).doc(data.code).delete();
      }
    } else {
      const boards = { ...data.boards };
      delete boards[user.uid];
      const lastMoves = { ...(data.lastMoves || {}) };
      delete lastMoves[user.uid];
      await docRef.update({
        players,
        playerUids: players.map((p) => p.uid),
        boards: flattenBoards(boards),
        lastMoves,
        hostId: players[0].uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  getOpponent(room, userId) {
    return room?.players?.find((p) => p.uid !== userId) ?? null;
  }

  getMe(room, userId) {
    return room?.players?.find((p) => p.uid === userId) ?? null;
  }
}

export { MAX_PLAYERS };
