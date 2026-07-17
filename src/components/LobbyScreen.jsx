import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { formatWinRate } from "../lib/ranking";
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from "../lib/difficulty";
import { signOut } from "../lib/auth";

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
  const [status, setStatus] = useState({ message: "", type: "" });
  const [joinCode, setJoinCode] = useState("");

  const createRoom = async () => {
    try {
      setStatus({ message: "Creando sala...", type: "" });
      const { roomId } = await gameService.createRoom(difficulty);
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
          <div className="lobby-grid lobby-grid-3">
            <div className="card">
              <h2>Crear sala</h2>
              <p>Crea una partida y comparte el código con tu rival.</p>

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

              <button type="button" className="btn btn-primary btn-large" onClick={createRoom}>
                Crear sala 1v1
              </button>
            </div>

            <div className="card">
              <h2>Modo solitario</h2>
              <p>Practica a tu ritmo sin rival ni ataques.</p>
              <p className="hint">Usa la misma dificultad seleccionada arriba.</p>
              <button
                type="button"
                className="btn btn-secondary btn-large"
                onClick={() => startSolo(difficulty)}
              >
                Jugar solo
              </button>
            </div>

            <div className="card">
              <h2>Unirse a sala</h2>
              <form onSubmit={joinRoom}>
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
        <RankingPanel />
      </div>
    </section>
  );
}
