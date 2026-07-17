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

  const startSolo = useCallback((difficultyId) => {
    const difficulty = getDifficulty(difficultyId);
    const { puzzle, solution } = generateSudoku(difficulty.cellsToRemove);
    const board = puzzle.map((row) => row.map((cell) => (cell === 0 ? 0 : cell)));

    setSoloSession({
      puzzle,
      solution,
      board,
      difficulty: difficulty.id,
      startedAt: Date.now(),
      finished: false,
    });
    setScreen("solo");
  }, []);

  const leaveSolo = useCallback(() => {
    setSoloSession(null);
    setScreen("lobby");
  }, []);

  const updateSoloCell = useCallback((row, col, value) => {
    setSoloSession((prev) => {
      if (!prev || prev.finished) return prev;

      const board = prev.board.map((r) => [...r]);
      board[row][col] = value;
      const finished = isBoardComplete(board, prev.solution, prev.puzzle);

      return {
        ...prev,
        board,
        finished,
        finishedAt: finished ? Date.now() : prev.finishedAt,
      };
    });
  }, []);

  useEffect(() => {
    if (!room || room.status !== "finished" || !user || statsRecorded.current) return;

    statsRecorded.current = true;
    rankingService?.recordMyResult(room);
    headToHeadService.recordMatch(room);
  }, [room, user, rankingService, headToHeadService]);

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
        startSolo,
        leaveSolo,
        updateSoloCell,
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
