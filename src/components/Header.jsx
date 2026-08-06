import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGame } from "../contexts/GameContext";
import { getUserDisplayName, signOut } from "../lib/auth";
import { loadLobbyPrefs } from "../lib/lobbyPrefs";
import { APP_VERSION } from "../lib/version";
import { JoinRoomModal } from "./JoinRoomModal";
import { MatchHistoryModal } from "./MatchHistoryModal";
import { ProfileModal } from "./ProfileModal";
import { RankingModal } from "./RankingModal";

export function Header() {
  const { user, profileRevision } = useAuth();
  const { screen, goHome, startSolo, gameService, enterRoom } = useGame();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const menuRef = useRef(null);
  const inviteJoinStarted = useRef(false);
  void profileRevision;

  const inVersusMatch = screen === "game";
  const canPlayActions = screen === "lobby";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (!code) return;
    try {
      sessionStorage.setItem("sudoku-invite", code.toUpperCase());
    } catch {
      /* ignore */
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!user || screen !== "lobby" || inviteJoinStarted.current) return;
    let stored = "";
    try {
      stored = sessionStorage.getItem("sudoku-invite") || "";
    } catch {
      stored = "";
    }
    if (!stored) return;

    inviteJoinStarted.current = true;
    try {
      sessionStorage.removeItem("sudoku-invite");
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        const { roomId } = await gameService.joinRoom(stored);
        enterRoom(roomId);
      } catch {
        inviteJoinStarted.current = false;
        setInviteCode(stored);
        setJoinOpen(true);
      }
    })();
  }, [user, screen, gameService, enterRoom]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleHome = (e) => {
    e.preventDefault();
    if (inVersusMatch) return;
    goHome();
  };

  const handleSolo = () => {
    if (!canPlayActions) return;
    const prefs = loadLobbyPrefs();
    setMenuOpen(false);
    startSolo(prefs.difficulty, prefs.options);
  };

  const handleJoin = () => {
    if (!canPlayActions) return;
    setMenuOpen(false);
    setJoinOpen(true);
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
          <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className={`user-bar user-bar-btn${menuOpen ? " open" : ""}`}
              onClick={() => setMenuOpen((v) => !v)}
              title="Menú de cuenta"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.photoURL && (
                <img src={user.photoURL} className="user-avatar" alt="" />
              )}
              <span>{getUserDisplayName(user)}</span>
              <span className="user-bar-gear" aria-hidden="true">
                {menuOpen ? "▴" : "▾"}
              </span>
            </button>
            {menuOpen && (
              <div className="user-dropdown" role="menu">
                <button
                  type="button"
                  className="user-dropdown-item"
                  role="menuitem"
                  disabled={!canPlayActions}
                  onClick={handleSolo}
                  title={canPlayActions ? "Practicar sin rival" : "Disponible desde el lobby"}
                >
                  🧩 Modo solitario
                </button>
                <button
                  type="button"
                  className="user-dropdown-item"
                  role="menuitem"
                  disabled={!canPlayActions}
                  onClick={handleJoin}
                  title={canPlayActions ? "Unirse con código" : "Disponible desde el lobby"}
                >
                  🔗 Unirse a sala
                </button>
                <div className="user-dropdown-sep" />
                <button
                  type="button"
                  className="user-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setRankingOpen(true);
                  }}
                >
                  🏆 Ranking global
                </button>
                <button
                  type="button"
                  className="user-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setHistoryOpen(true);
                  }}
                >
                  📜 Historial versus
                </button>
                <div className="user-dropdown-sep" />
                <button
                  type="button"
                  className="user-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setProfileOpen(true);
                  }}
                >
                  ⚙ Mi perfil
                </button>
                <button
                  type="button"
                  className="user-dropdown-item danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {rankingOpen && <RankingModal onClose={() => setRankingOpen(false)} />}
      {historyOpen && <MatchHistoryModal onClose={() => setHistoryOpen(false)} />}
      {joinOpen && (
        <JoinRoomModal
          initialCode={inviteCode}
          onClose={() => {
            setJoinOpen(false);
            setInviteCode("");
          }}
        />
      )}
    </>
  );
}
