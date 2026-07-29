import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { getUserDisplayName } from "../lib/auth";
import { APP_VERSION } from "../lib/version";
import { ProfileModal } from "./ProfileModal";

export function Header() {
  const { user, profileRevision } = useAuth();
  const { screen, goHome } = useGame();
  const [profileOpen, setProfileOpen] = useState(false);
  void profileRevision;

  const inVersusMatch = screen === "game";

  const handleHome = (e) => {
    e.preventDefault();
    if (inVersusMatch) return;
    goHome();
  };

  return (
    <>
      <header className="header">
        <div className="logo-block">
          {inVersusMatch ? (
            <div className="logo logo-static" title="No disponible durante la partida">
              <span className="logo-icon">⚔️</span>
              <h1>Sudoku Battle</h1>
            </div>
          ) : (
            <a href="/" className="logo logo-link" onClick={handleHome}>
              <span className="logo-icon">⚔️</span>
              <h1>Sudoku Battle</h1>
            </a>
          )}
          <span className="app-version">v{APP_VERSION}</span>
        </div>
        {user && (
          <button
            type="button"
            className="user-bar user-bar-btn"
            onClick={() => setProfileOpen(true)}
            title="Abrir perfil"
          >
            {user.photoURL && (
              <img src={user.photoURL} className="user-avatar" alt="" />
            )}
            <span>{getUserDisplayName(user)}</span>
            <span className="user-bar-gear" aria-hidden="true">⚙</span>
          </button>
        )}
      </header>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
}
