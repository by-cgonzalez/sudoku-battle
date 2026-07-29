import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { formatWinRate } from "../lib/ranking";
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from "../lib/difficulty";
import {
  BATTLE_MODES,
  DEFAULT_BATTLE_MODE,
  DEFAULT_GAME_OPTIONS,
  normalizeGameOptions,
} from "../lib/features";
import { signOut } from "../lib/auth";
import { OptionsPanel } from "./OptionsPanel";

export function RankingPanel() {
  const { user, rankingService } = useAuth();
  const [entries, setEntries] = useState([]);
  const [myStats, setMyStats] = useState(null);

  useEffect(() => {
    if (!rankingService) return;
    rankingService.listenLeaderboard(setEntries);
    return () => rankingService.stopListening();
  }, [rankingService]);

  useEffect(() => {
    if (!rankingService || !user) return;
    rankingService.getPlayerRank(user.uid).then(setMyStats);
  }, [rankingService, user, entries]);

  return (
    <aside className="ranking-panel card">
      <h2>🏆 Ranking global</h2>
      <div className="my-stats">
        {myStats ? (
          <div className="my-stats-grid">
            <div className="stat-box">
              <span className="stat-value">{myStats.points || 0}</span>
              <span className="stat-label">Puntos</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{myStats.wins || 0}</span>
              <span className="stat-label">Victorias</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{myStats.losses || 0}</span>
              <span className="stat-label">Derrotas</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{formatWinRate(myStats.wins, myStats.games)}</span>
              <span className="stat-label">Win rate</span>
            </div>
          </div>
        ) : (
          <p className="ranking-empty">Juega tu primera partida para aparecer en el ranking</p>
        )}
      </div>
      <ul className="leaderboard-list">
        {entries.length === 0 ? (
          <li className="ranking-empty">Aún no hay partidas registradas</li>
        ) : (
          entries.map((entry, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            return (
              <li key={entry.id} className={`ranking-item ${entry.uid === user?.uid ? "is-me" : ""}`}>
                <span className="ranking-pos">{medal}</span>
                <div className="ranking-avatar">
                  {entry.photoURL ? (
                    <img src={entry.photoURL} alt="" />
                  ) : (
                    <span>{(entry.name || "?")[0]}</span>
                  )}
                </div>
                <div className="ranking-info">
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.wins || 0}V · {entry.losses || 0}D · {formatWinRate(entry.wins, entry.games)}
                  </span>
                </div>
                <span className="ranking-points">{entry.points || 0} pts</span>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

export function LobbyScreen() {
  const { gameService, enterRoom, startSolo } = useGame();
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [battleMode, setBattleMode] = useState(DEFAULT_BATTLE_MODE);
  const [options, setOptions] = useState(() => ({ ...DEFAULT_GAME_OPTIONS }));
  const [status, setStatus] = useState({ message: "", type: "" });
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("join");
    if (inviteCode) {
      setJoinCode(inviteCode.toUpperCase());
      setStatus({
        message: `Invitación detectada: ${inviteCode.toUpperCase()}. Pulsa Unirse.`,
        type: "",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const createRoom = async () => {
    try {
      setStatus({ message: "Creando sala...", type: "" });
      const { roomId } = await gameService.createRoom(
        difficulty,
        battleMode,
        normalizeGameOptions(options)
      );
      enterRoom(roomId);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    try {
      setStatus({ message: "Uniéndose...", type: "" });
      const { roomId } = await gameService.joinRoom(joinCode.trim());
      enterRoom(roomId);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  };

  return (
    <section className="screen active">
      <div className="lobby-layout">
        <div className="lobby-main">
          <div className="lobby-hero">
            <h2>Elige tu batalla</h2>
            <p>Crea una sala 1v1, únete con un código o practica en solitario.</p>
          </div>

          <div className="lobby-top">
            <div className="card lobby-card create-room-card">
              <h2>Crear sala</h2>
              <p>Configura la partida e invita a tu rival.</p>

              <label className="section-label">Dificultad</label>
              <div className="difficulty-options">
                {Object.values(DIFFICULTIES).map((d) => (
                  <label key={d.id} className="difficulty-option">
                    <input
                      type="radio"
                      name="difficulty"
                      value={d.id}
                      checked={difficulty === d.id}
                      onChange={() => setDifficulty(d.id)}
                    />
                    <span className="difficulty-card">
                      <span className="difficulty-icon">{d.icon}</span>
                      <span className="difficulty-name">{d.label}</span>
                      <span className="difficulty-desc">+{d.winPoints} pts al ganar</span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="section-label">Modalidad battle</label>
              <div className="battle-options">
                {Object.values(BATTLE_MODES).map((mode) => (
                  <label key={mode.id} className="battle-option">
                    <input
                      type="radio"
                      name="battleMode"
                      value={mode.id}
                      checked={battleMode === mode.id}
                      onChange={() => setBattleMode(mode.id)}
                    />
                    <span className="battle-card">
                      <span className="battle-icon">{mode.icon}</span>
                      <span className="battle-name">{mode.label}</span>
                      <span className="battle-desc">{mode.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="create-options-wrap">
                <OptionsPanel
                  options={options}
                  onChange={setOptions}
                  collapsible
                  defaultOpen={false}
                  compact
                />
                <p className="hint options-hint">
                  Quien invita define estas opciones para la sala. También aplican en solitario.
                </p>
              </div>

              <button type="button" className="btn btn-primary btn-large" onClick={createRoom}>
                Crear sala 1v1
              </button>
            </div>

            <RankingPanel />
          </div>

          <div className="lobby-grid lobby-grid-2">
            <div className="card lobby-card">
              <h2>Modo solitario</h2>
              <p>Practica con las opciones del panel, sin rival ni ataques.</p>
              <p className="hint">Usa la dificultad y opciones de Crear sala.</p>
              <button
                type="button"
                className="btn btn-secondary btn-large"
                onClick={() => startSolo(difficulty, options)}
              >
                Jugar solo
              </button>
            </div>

            <div className="card lobby-card">
              <h2>Unirse a sala</h2>
              <p>Pega el código o abre un enlace de invitación.</p>
              <form onSubmit={joinRoom} className="join-form">
                <label>Código de sala</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                  placeholder="ABC123"
                  style={{ textTransform: "uppercase" }}
                />
                <button type="submit" className="btn btn-secondary btn-large">Unirse</button>
              </form>
            </div>
          </div>

          <p className={`status-message ${status.type}`}>{status.message}</p>
          <button type="button" className="btn btn-ghost" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </section>
  );
}
