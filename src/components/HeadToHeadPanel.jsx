import { getHeadToHeadStats, formatMatchDate } from "../lib/headToHead";
import { getDifficulty } from "../lib/difficulty";
import { useAuth } from "../contexts/AuthContext";

function MatchHistoryItem({ match, myUid }) {
  const diff = getDifficulty(match.difficulty);
  const won = match.winnerId === myUid;
  const myScore = match.scores?.[myUid] ?? "—";
  const oppScore = match.scores
    ? Object.entries(match.scores).find(([uid]) => uid !== myUid)?.[1] ?? "—"
    : "—";

  return (
    <li className={`history-item ${won ? "won" : "lost"}`}>
      <span className="history-result">{won ? "✅ Victoria" : "❌ Derrota"}</span>
      <span className="history-score">{myScore} - {oppScore}</span>
      <span className="history-meta">
        {diff.icon} {diff.label} · {formatMatchDate(match.finishedAt)}
      </span>
    </li>
  );
}

export function HeadToHeadPanel({ rivalry, opponent, compact = false }) {
  const { user } = useAuth();
  if (!opponent || !user) return null;

  const stats = getHeadToHeadStats(rivalry, user.uid, opponent);
  const panelClass = compact
    ? "head-to-head-panel card-small"
    : "head-to-head-panel";

  return (
    <div className={panelClass}>
      <h3>📊 Historial vs {opponent.name}</h3>
      <div className={`h2h-scoreboard ${compact ? "compact" : ""}`}>
        <div className="h2h-player">
          <span className="h2h-label">Tú</span>
          <span className={`h2h-wins ${compact ? "compact-wins" : ""} ${stats.myWins > stats.opponentWins ? "has-crown" : ""}`}>
            {stats.myWins}
          </span>
          {!compact && <span className="h2h-sub">victorias</span>}
        </div>
        <span className="h2h-divider">—</span>
        <div className="h2h-player">
          <span className="h2h-label">{opponent.name}</span>
          <span className={`h2h-wins ${compact ? "compact-wins" : ""} ${stats.opponentWins > stats.myWins ? "has-crown" : ""}`}>
            {stats.opponentWins}
          </span>
          {!compact && <span className="h2h-sub">victorias</span>}
        </div>
      </div>
      {!compact && (
        <p className="h2h-total">
          {stats.totalGames === 0
            ? "Primera partida juntos"
            : `${stats.totalGames} partida${stats.totalGames !== 1 ? "s" : ""} jugadas juntos`}
        </p>
      )}
      <ul className={`match-history ${compact ? "compact" : ""}`}>
        {stats.recentMatches.length === 0 ? (
          <li className="history-empty">Primera partida juntos</li>
        ) : (
          stats.recentMatches.map((m) => (
            <MatchHistoryItem key={`${m.roomId}-${m.finishedAt}`} match={m} myUid={user.uid} />
          ))
        )}
      </ul>
    </div>
  );
}
