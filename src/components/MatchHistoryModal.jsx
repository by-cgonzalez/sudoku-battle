import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getBattleMode } from "../lib/features";
import { getDifficulty } from "../lib/difficulty";
import { formatHistoryDate, getVersusHistory } from "../lib/matchHistory";

export function MatchHistoryModal({ onClose }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;

    if (!uid) {
      setHistory([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    getVersusHistory(uid)
      .then((list) => {
        if (!cancelled) {
          setHistory(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const wins = history.filter((m) => m.won).length;
  const losses = history.length - wins;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>📜 Historial versus</h3>
          <button type="button" className="btn btn-ghost profile-close" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <p className="hint">
          Tus partidas 1v1 vinculadas a tu perfil
          {!loading && history.length > 0 ? ` · ${wins}V / ${losses}D` : ""}.
        </p>

        {loading ? (
          <p className="ranking-empty">Cargando historial…</p>
        ) : history.length === 0 ? (
          <p className="ranking-empty">Aún no tienes partidas versus registradas.</p>
        ) : (
          <ul className="history-list">
            {history.map((match) => {
              const diff = getDifficulty(match.difficulty);
              const battle = getBattleMode(match.battleMode);
              const scoreLabel =
                match.battleMode === "zones"
                  ? `${match.myScore} – ${match.oppScore} zonas`
                  : match.battleMode === "score"
                    ? `${match.myScore} – ${match.oppScore} pts`
                    : `${match.mySolved} – ${match.oppSolved} aciertos`;

              return (
                <li
                  key={match.roomId}
                  className={`history-item ${match.won ? "won" : "lost"}`}
                >
                  <div className="history-result">
                    <span className="history-badge">{match.won ? "Victoria" : "Derrota"}</span>
                    <span className="history-points">+{match.pointsEarned} pts</span>
                  </div>
                  <div className="history-main">
                    <strong>vs {match.opponentName}</strong>
                    <span>
                      {diff.icon} {diff.label} · {battle.icon} {battle.label}
                    </span>
                    <span className="history-score">{scoreLabel}</span>
                  </div>
                  <time className="history-date">{formatHistoryDate(match.finishedAt)}</time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
