import { useAuth } from "../contexts/AuthContext";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="header">
      <div className="logo">
        <span className="logo-icon">⚔️</span>
        <h1>Sudoku Battle</h1>
      </div>
      {user && (
        <div className="user-bar">
          {user.photoURL && (
            <img src={user.photoURL} className="user-avatar" alt="" />
          )}
          <span>{user.displayName || user.email}</span>
        </div>
      )}
    </header>
  );
}
