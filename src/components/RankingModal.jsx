import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { formatWinRate } from "../lib/ranking";

export function RankingModal({ onClose }) {
  const { user, rankingService } = useAuth();
  const [entries, setEntries] = useState([]);
  const [myStats, setMyStats] = useState(null);

  useEffect(() => {
    if (!rankingService) return;
    rankingService.listenLeaderboard(setEntries, 20);
    return () => rankingService.stopListening();
  }, [rankingService]);

  useEffect(() => {
    if (!rankingService || !user) return;
    rankingService.getPlayerRank(user.uid).then(setMyStats);
  }, [rankingService, user, entries]);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content ranking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>🏆 Ranking global</h3>
          <button type="button" className="btn btn-ghost profile-close" onClick={onClose}>
            Cerrar
          </button>
        </div>

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
            <p className="ranking-empty">Juega tu primera partida versus para aparecer en el ranking</p>
          )}
        </div>

        <ul className="leaderboard-list">
          {entries.length === 0 ? (
            <li className="ranking-empty">Aún no hay partidas registradas</li>
          ) : (
            entries.map((entry, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
              return (
                <li
                  key={entry.id}
                  className={`ranking-item ${entry.uid === user?.uid ? "is-me" : ""}`}
                >
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
                      {entry.wins || 0}V · {entry.losses || 0}D ·{" "}
                      {formatWinRate(entry.wins, entry.games)}
                    </span>
                  </div>
                  <span className="ranking-points">{entry.points || 0} pts</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
