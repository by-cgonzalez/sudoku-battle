import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { MAX_PLAYERS } from "../lib/game";
import { DIFFICULTIES, getDifficulty } from "../lib/difficulty";
import {
  buildInviteText,
  getBattleMode,
  getInviteUrl,
  normalizeGameOptions,
} from "../lib/features";
import { getUserDisplayName } from "../lib/auth";
import { HeadToHeadPanel } from "./HeadToHeadPanel";
import { OptionsPanel } from "./OptionsPanel";

function inviteQrUrl(inviteUrl, size = 72) {
  const params = new URLSearchParams({
    text: inviteUrl,
    size: String(size),
    margin: "1",
    dark: "e8edf5",
    light: "00000000",
  });
  return `https://quickchart.io/qr?${params.toString()}`;
}

function FighterCard({ player, side, isHost, waiting = false }) {
  if (waiting || !player) {
    return (
      <div className={`fighter-card fighter-${side} fighter-empty`}>
        <div className="fighter-avatar waiting" aria-hidden="true">
          <span>?</span>
        </div>
        <div className="fighter-info">
          <strong className="fighter-name">Esperando rival</strong>
          <span className="fighter-role">Plaza libre</span>
        </div>
      </div>
    );
  }

  const initial = (player.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className={`fighter-card fighter-${side}`}>
      <div className="fighter-avatar" aria-hidden="true">
        {player.photoURL ? <img src={player.photoURL} alt="" /> : <span>{initial}</span>}
      </div>
      <div className="fighter-info">
        <strong className="fighter-name">{player.name}</strong>
        <span className="fighter-role">
          {side === "left" ? "🛡️" : "⚔️"} {isHost ? "Anfitrión" : "Rival"}
        </span>
      </div>
    </div>
  );
}

export function RoomScreen() {
  const { user } = useAuth();
  const { room, rivalry, gameService, leaveRoom, getOpponent } = useGame();
  const [status, setStatus] = useState({ message: "", type: "" });
  const [copied, setCopied] = useState("");
  const [diffBusy, setDiffBusy] = useState(false);

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
  const me = room.players.find((p) => p.uid === user?.uid) || room.players[0];
  const rival = opponent || null;
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

  const changeDifficulty = async (difficultyId) => {
    if (!isHost || diffBusy || difficultyId === room.difficulty) return;
    try {
      setDiffBusy(true);
      await gameService.updateDifficulty(room.id, difficultyId);
      setStatus({ message: "", type: "" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setDiffBusy(false);
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
          <div className="room-hero room-hero-compact">
            <div className="room-hero-main">
              <p className="room-label">Código de sala</p>
              <h2 className="room-code">{room.code}</h2>
              <div className="room-meta">
                <span className="room-difficulty-badge">{diff.icon} {diff.label}</span>
                <span className="room-difficulty-badge">{battle.icon} {battle.label}</span>
              </div>
            </div>
          </div>

          <div className="battle-arena" aria-label="Enfrentamiento">
            <FighterCard
              player={me}
              side="left"
              isHost={me?.uid === room.hostId}
            />
            <div className="battle-center">
              <span className="battle-vs-icon" aria-hidden="true">⚔️</span>
              <span className="battle-vs">VS</span>
              <span className="battle-ready">
                {rival ? "Listos para combatir" : "Buscando rival…"}
              </span>
            </div>
            <FighterCard
              player={rival}
              side="right"
              isHost={rival?.uid === room.hostId}
              waiting={!rival}
            />
          </div>

          <div className="room-diff-panel">
            <div className="room-diff-header">
              <h3>Dificultad</h3>
              <p>
                {isHost
                  ? "Puedes cambiarla mientras esperas (regenera el sudoku)."
                  : "Definida por el anfitrión."}
              </p>
            </div>
            <div className="room-diff-options" role="group" aria-label="Dificultad de la sala">
              {Object.values(DIFFICULTIES).map((d) => {
                const selected = room.difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`room-diff-option${selected ? " selected" : ""}`}
                    style={{ "--diff-accent": d.accent }}
                    disabled={!isHost || diffBusy}
                    onClick={() => changeDifficulty(d.id)}
                    title={
                      isHost
                        ? `Cambiar a ${d.label}`
                        : `${d.label} · solo el anfitrión puede cambiar`
                    }
                  >
                    <span className="room-diff-icon" aria-hidden="true">
                      {d.icon}
                    </span>
                    <span className="room-diff-name">{d.label}</span>
                    <span className="room-diff-meta">+{d.winPoints} pts</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="host-hint">
            {isHost
              ? canStart
                ? "¡Listo! Inicia la partida cuando quieras."
                : "Comparte la invitación y espera al segundo jugador..."
              : "Esperando a que el anfitrión inicie..."}
          </p>
          <p className={`status-message ${status.type}`}>{status.message}</p>

          <div className="room-actions room-actions-top">
            <button
              type="button"
              className="btn btn-primary btn-large"
              disabled={!canStart}
              onClick={startGame}
            >
              ⚔️ Iniciar partida
            </button>
            <button type="button" className="btn btn-ghost" onClick={leaveRoom}>
              Salir de la sala
            </button>
          </div>

          {opponent && room.players.length === MAX_PLAYERS && (
            <HeadToHeadPanel rivalry={rivalry} opponent={opponent} />
          )}

          <div className="invite-panel invite-panel-compact">
            <div className="invite-compact-main">
              <div className="invite-compact-copy">
                <h3>Invitar rival</h3>
                <p className="invite-url" title={inviteUrl}>
                  {inviteUrl}
                </p>
                <div className="invite-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyValue(room.code, "code")}
                  >
                    {copied === "code" ? "Código ✓" : "Código"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyValue(inviteUrl, "link")}
                  >
                    {copied === "link" ? "Link ✓" : "Link"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={shareInvite}
                  >
                    {copied === "invite" ? "Copiado ✓" : "Compartir"}
                  </button>
                </div>
              </div>
              <a
                className="room-qr room-qr-compact"
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                title="Escanea desde el celular para unirte"
              >
                <img
                  src={qrSrc}
                  alt={`QR para unirse a la sala ${room.code}`}
                  width={72}
                  height={72}
                />
              </a>
            </div>
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
