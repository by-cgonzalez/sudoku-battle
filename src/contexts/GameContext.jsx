import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GameService } from "../lib/game";
import { HeadToHeadService } from "../lib/headToHead";
import { getDifficulty } from "../lib/difficulty";
import { canUseHint, HINT_COST, normalizeGameOptions, playerScore } from "../lib/features";
import { countZonesFor, normalizeZones } from "../lib/zones";
import { recordVersusMatch } from "../lib/matchHistory";
import { generateSudoku, isBoardComplete } from "../lib/sudoku";
import { useAuth } from "./AuthContext";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { user, rankingService } = useAuth();
  const [room, setRoom] = useState(null);
  const [rivalry, setRivalry] = useState(null);
  const [soloSession, setSoloSession] = useState(null);
  const [screen, setScreen] = useState("lobby");
  const statsRecorded = useRef(false);

  const gameService = useMemo(() => new GameService(), []);
  const headToHeadService = useMemo(() => new HeadToHeadService(), []);

  const getOpponent = useCallback(
    (roomData) => (user ? gameService.getOpponent(roomData, user.uid) : null),
    [gameService, user]
  );

  const getMe = useCallback(
    (roomData) => (user ? gameService.getMe(roomData, user.uid) : null),
    [gameService, user]
  );

  const enterRoom = useCallback(
    (roomId) => {
      statsRecorded.current = false;
      gameService.listenRoom(roomId, (roomData) => {
        setRoom(roomData);
        const opponent = user ? gameService.getOpponent(roomData, user.uid) : null;

        if (opponent) {
          headToHeadService.listenRivalry(opponent.uid, setRivalry);
        } else {
          headToHeadService.stopListening();
          setRivalry(null);
        }

        if (roomData.status === "playing" || roomData.status === "finished") {
          setScreen("game");
        } else {
          setScreen("room");
        }
      });
    },
    [gameService, headToHeadService, user]
  );

  const leaveRoom = useCallback(async () => {
    if (room) await gameService.leaveRoom(room.id);
    gameService.stopListening();
    headToHeadService.stopListening();
    setRoom(null);
    setRivalry(null);
    statsRecorded.current = false;
    setScreen("lobby");
  }, [gameService, headToHeadService, room]);

  const startSolo = useCallback((difficultyId, options = {}) => {
    const difficulty = getDifficulty(difficultyId);
    const { puzzle, solution } = generateSudoku(difficulty.cellsToRemove);
    const board = puzzle.map((row) => row.map((cell) => (cell === 0 ? 0 : cell)));

    setSoloSession({
      puzzle,
      solution,
      board,
      difficulty: difficulty.id,
      options: normalizeGameOptions(options),
      startedAt: Date.now(),
      finished: false,
      hintsUsed: 0,
      solvedCount: 0,
      mistakes: 0,
      lastMove: null,
      completionRecorded: false,
    });
    setScreen("solo");
  }, []);

  const leaveSolo = useCallback(() => {
    setSoloSession(null);
    setScreen("lobby");
  }, []);

  const goHome = useCallback(async () => {
    if (screen === "game") return;
    if (soloSession) {
      leaveSolo();
      return;
    }
    if (room) {
      await leaveRoom();
      return;
    }
    setScreen("lobby");
  }, [screen, soloSession, room, leaveSolo, leaveRoom]);

  const recordSoloMistake = useCallback(() => {
    setSoloSession((prev) => {
      if (!prev || prev.finished) return prev;
      return { ...prev, mistakes: (prev.mistakes || 0) + 1 };
    });
  }, []);

  const markSoloCompletionRecorded = useCallback(() => {
    setSoloSession((prev) => {
      if (!prev) return prev;
      return { ...prev, completionRecorded: true };
    });
  }, []);

  const updateSoloCell = useCallback((row, col, value) => {
    setSoloSession((prev) => {
      if (!prev || prev.finished) return prev;

      const board = prev.board.map((r) => [...r]);
      const previous = board[row][col];
      board[row][col] = value;

      const wasCorrect =
        value !== 0 && value === prev.solution[row][col] && previous !== value;
      const wasCleared =
        value === 0 && previous !== 0 && previous === prev.solution[row][col];

      let solvedCount = prev.solvedCount || 0;
      if (wasCorrect) solvedCount += 1;
      else if (wasCleared) solvedCount = Math.max(0, solvedCount - 1);

      const finished = isBoardComplete(board, prev.solution, prev.puzzle);

      return {
        ...prev,
        board,
        solvedCount,
        lastMove: { row, col, previous, value, fromHint: false },
        finished,
        finishedAt: finished ? Date.now() : prev.finishedAt,
      };
    });
  }, []);

  const useSoloHint = useCallback((row, col) => {
    let result = { ok: false, reason: "No se pudo usar el hint" };

    setSoloSession((prev) => {
      if (!prev || prev.finished) return prev;
      if (prev.puzzle[row][col] !== 0) return prev;

      const check = canUseHint({
        solvedCount: prev.solvedCount || 0,
        hintsUsed: prev.hintsUsed || 0,
      });
      if (!check.ok) {
        result = check;
        return prev;
      }

      const board = prev.board.map((r) => [...r]);
      const previous = board[row][col];
      const value = prev.solution[row][col];
      if (previous === value) {
        result = { ok: false, reason: "Esa celda ya está resuelta" };
        return prev;
      }

      board[row][col] = value;
      const finished = isBoardComplete(board, prev.solution, prev.puzzle);
      result = { ok: true, value, cost: HINT_COST };

      return {
        ...prev,
        board,
        solvedCount: (prev.solvedCount || 0) + 1,
        hintsUsed: (prev.hintsUsed || 0) + 1,
        lastMove: { row, col, previous, value, fromHint: true },
        finished,
        finishedAt: finished ? Date.now() : prev.finishedAt,
      };
    });

    return result;
  }, []);

  useEffect(() => {
    if (!room || room.status !== "finished" || !user || statsRecorded.current) return;

    statsRecorded.current = true;
    rankingService?.recordMyResult(room);
    headToHeadService.recordMatch(room);

    const me = getMe(room);
    const opponent = getOpponent(room);
    const won = room.winner === user.uid;
    const diff = getDifficulty(room.difficulty);
    const zones = normalizeZones(room.zones);
    const isZones = room.battleMode === "zones";
    void recordVersusMatch(user.uid, {
      roomId: room.id,
      finishedAt: Date.now(),
      won,
      opponentName: opponent?.name || room.winnerName || "Rival",
      opponentUid: opponent?.uid || "",
      difficulty: room.difficulty,
      battleMode: room.battleMode || "race",
      mySolved: me?.solvedCount || 0,
      oppSolved: opponent?.solvedCount || 0,
      myScore: isZones
        ? countZonesFor(zones, user.uid)
        : playerScore(me),
      oppScore: isZones
        ? countZonesFor(zones, opponent?.uid)
        : playerScore(opponent),
      pointsEarned: won ? diff.winPoints : 5,
    });
  }, [room, user, rankingService, headToHeadService, getMe, getOpponent]);

  useEffect(() => {
    if (!user && screen !== "lobby") {
      gameService.stopListening();
      headToHeadService.stopListening();
      setRoom(null);
      setRivalry(null);
      setSoloSession(null);
      setScreen("lobby");
    }
  }, [user, screen, gameService, headToHeadService]);

  return (
    <GameContext.Provider
      value={{
        room,
        rivalry,
        screen,
        setScreen,
        gameService,
        headToHeadService,
        enterRoom,
        leaveRoom,
        goHome,
        startSolo,
        leaveSolo,
        updateSoloCell,
        useSoloHint,
        recordSoloMistake,
        markSoloCompletionRecorded,
        soloSession,
        getOpponent,
        getMe,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
