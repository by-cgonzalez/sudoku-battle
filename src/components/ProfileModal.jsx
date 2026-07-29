import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  changePassword,
  getUserDisplayName,
  hasPasswordProvider,
  updateNickname,
} from "../lib/auth";

export function ProfileModal({ onClose }) {
  const { user, rankingService, refreshUser } = useAuth();
  const [nickname, setNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ message: "", type: "" });
  const [savingNick, setSavingNick] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const canChangePassword = hasPasswordProvider(user);

  useEffect(() => {
    setNickname(getUserDisplayName(user));
  }, [user]);

  const handleNickname = async (e) => {
    e.preventDefault();
    try {
      setSavingNick(true);
      setStatus({ message: "Guardando apodo...", type: "" });
      const updated = await updateNickname(nickname);
      await rankingService?.updateDisplayName(updated.displayName);
      await refreshUser();
      setStatus({ message: "Apodo actualizado", type: "success" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setSavingNick(false);
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ message: "Las contraseñas no coinciden", type: "error" });
      return;
    }
    try {
      setSavingPass(true);
      setStatus({ message: "Actualizando contraseña...", type: "" });
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus({ message: "Contraseña actualizada", type: "success" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>Mi perfil</h3>
          <button type="button" className="btn btn-ghost profile-close" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="profile-identity">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar placeholder">
              {getUserDisplayName(user)[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <strong>{getUserDisplayName(user)}</strong>
            <span className="profile-email">{user?.email || ""}</span>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleNickname}>
          <h4>Apodo</h4>
          <p className="hint">Se mostrará en el juego, salas y ranking en lugar del nombre.</p>
          <label>Apodo</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            minLength={2}
            required
            placeholder="Tu apodo"
          />
          <button type="submit" className="btn btn-primary" disabled={savingNick}>
            {savingNick ? "Guardando..." : "Guardar apodo"}
          </button>
        </form>

        <form className="profile-form" onSubmit={handlePassword}>
          <h4>Contraseña</h4>
          {canChangePassword ? (
            <>
              <label>Contraseña actual</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
              <label>Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Repite la contraseña"
              />
              <button type="submit" className="btn btn-secondary" disabled={savingPass}>
                {savingPass ? "Actualizando..." : "Cambiar contraseña"}
              </button>
            </>
          ) : (
            <p className="hint">
              Entraste con Google o Facebook. La contraseña se gestiona en ese proveedor.
            </p>
          )}
        </form>

        <p className={`status-message ${status.type}`}>{status.message}</p>
      </div>
    </div>
  );
}
