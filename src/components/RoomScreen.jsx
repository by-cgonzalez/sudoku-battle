import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { MAX_PLAYERS } from "../lib/game";
import { getDifficulty } from "../lib/difficulty";
import { HeadToHeadPanel } from "./HeadToHeadPanel";

export function RoomScreen() {
  const { user } = useAuth();
  const { room, rivalry, gameService, leaveRoom, getOpponent } = useGame();
  const [status, setStatus] = useState({ message: "", type: "" });

  if (!room) return null;

  const diff = getDifficulty(room.difficulty);
  const opponent = getOpponent(room);
  const isHost = room.hostId === user?.uid;
  const canStart = isHost && room.players.length === MAX_PLAYERS;

  const startGame = async () => {
    try {
      await gameService.startGame(room.id);
      setStatus({ message: "", type: "" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  };

  return (
    <section className="screen active">
      <div className="card room-card">
        <p className="room-label">Código de sala</p>
        <h2 className="room-code">{room.code}</h2>
        <p className="room-difficulty-badge">{diff.icon} {diff.label}</p>
        <p className="subtitle">Comparte este código con tu oponente</p>

        <ul className="players-list">
          {room.players.map((p, i) => (
            <li key={p.uid} className="player-card">
              <div className="player-avatar">
                {p.photoURL ? <img src={p.photoURL} alt="" /> : <span>{p.name[0]}</span>}
              </div>
              <div>
                <strong>{p.name}</strong>
                <span className="player-slot">Jugador {i + 1}</span>
              </div>
            </li>
          ))}
          {Array.from({ length: MAX_PLAYERS - room.players.length }).map((_, i) => (
            <li key={`empty-${i}`} className="player-card empty">
              <span>Esperando jugador...</span>
            </li>
          ))}
        </ul>

        {opponent && room.players.length === MAX_PLAYERS && (
          <HeadToHeadPanel rivalry={rivalry} opponent={opponent} />
        )}

        <p className="host-hint">
          {isHost
            ? canStart
              ? "¡Listo! Inicia la partida cuando quieras."
              : "Esperando al segundo jugador..."
            : "Esperando a que el anfitrión inicie..."}
        </p>
        <p className={`status-message ${status.type}`}>{status.message}</p>

        <div className="room-actions">
          <button
            type="button"
            className="btn btn-primary btn-large"
            disabled={!canStart}
            onClick={startGame}
          >
            Iniciar partida
          </button>
          <button type="button" className="btn btn-ghost" onClick={leaveRoom}>
            Salir de la sala
          </button>
        </div>
      </div>
    </section>
  );
}
