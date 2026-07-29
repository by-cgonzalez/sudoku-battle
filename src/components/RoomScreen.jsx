import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { MAX_PLAYERS } from "../lib/game";
import { getDifficulty } from "../lib/difficulty";
import {
  buildInviteText,
  getBattleMode,
  getInviteUrl,
  normalizeGameOptions,
} from "../lib/features";
import { getUserDisplayName } from "../lib/auth";
import { HeadToHeadPanel } from "./HeadToHeadPanel";
import { OptionsPanel } from "./OptionsPanel";

function inviteQrUrl(inviteUrl, size = 112) {
  const params = new URLSearchParams({
    text: inviteUrl,
    size: String(size),
    margin: "1",
    dark: "e8edf5",
    light: "00000000",
  });
  return `https://quickchart.io/qr?${params.toString()}`;
}

export function RoomScreen() {
  const { user } = useAuth();
  const { room, rivalry, gameService, leaveRoom, getOpponent } = useGame();
  const [status, setStatus] = useState({ message: "", type: "" });
  const [copied, setCopied] = useState("");

  const inviteUrl = room?.code ? getInviteUrl(room.code) : "";
  const qrSrc = useMemo(
    () => (inviteUrl ? inviteQrUrl(inviteUrl) : ""),
    [inviteUrl]
  );

  if (!room) return null;

  const diff = getDifficulty(room.difficulty);
  const battle = getBattleMode(room.battleMode);
  const options = normalizeGameOptions(room.options);
  const opponent = getOpponent(room);
  const isHost = room.hostId === user?.uid;
  const canStart = isHost && room.players.length === MAX_PLAYERS;
  const inviteText = buildInviteText({
    code: room.code,
    hostName: getUserDisplayName(user),
    difficultyLabel: diff.label,
    battleModeLabel: battle.label,
  });

  const startGame = async () => {
    try {
      await gameService.startGame(room.id);
      setStatus({ message: "", type: "" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  };

  const copyValue = async (value, kind) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setStatus({ message: "No se pudo copiar. Copia manualmente.", type: "error" });
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Sudoku Battle",
          text: inviteText,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    await copyValue(inviteText, "invite");
  };

  return (
    <section className="screen active">
      <div className="room-layout">
        <div className="card room-card">
          <div className="room-hero">
            <div className="room-hero-main">
              <p className="room-label">Código de sala</p>
              <h2 className="room-code">{room.code}</h2>

              <div className="room-meta">
                <span className="room-difficulty-badge">{diff.icon} {diff.label}</span>
                <span className="room-difficulty-badge">{battle.icon} {battle.label}</span>
              </div>
              <p className="subtitle room-hero-desc">{battle.desc}</p>
            </div>

            <a
              className="room-qr"
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              title="Escanea desde el celular para unirte"
            >
              <img src={qrSrc} alt={`QR para unirse a la sala ${room.code}`} width={112} height={112} />
            </a>
          </div>

          <div className="invite-panel">
            <h3>Invitar rival</h3>
            <p className="invite-url">{inviteUrl}</p>
            <div className="invite-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyValue(room.code, "code")}
              >
                {copied === "code" ? "Código copiado" : "Copiar código"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyValue(inviteUrl, "link")}
              >
                {copied === "link" ? "Link copiado" : "Copiar link"}
              </button>
              <button type="button" className="btn btn-primary" onClick={shareInvite}>
                {copied === "invite" ? "Invitación copiada" : "Compartir invitación"}
              </button>
            </div>
          </div>

          <ul className="players-list">
            {room.players.map((p, i) => (
              <li key={p.uid} className="player-card">
                <div className="player-avatar">
                  {p.photoURL ? <img src={p.photoURL} alt="" /> : <span>{p.name[0]}</span>}
                </div>
                <div>
                  <strong>{p.name}</strong>
                  <span className="player-slot">
                    Jugador {i + 1}
                    {p.uid === room.hostId ? " · Anfitrión" : ""}
                  </span>
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
                : "Comparte la invitación y espera al segundo jugador..."
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

        <div className="card room-options-card">
          <OptionsPanel
            options={options}
            readOnly
            title={isHost ? "Opciones de la sala" : "Opciones definidas por el anfitrión"}
          />
        </div>
      </div>
    </section>
  );
}
