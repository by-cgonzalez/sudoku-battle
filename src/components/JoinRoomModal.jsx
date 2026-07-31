import { useEffect, useState } from "react";
import { useGame } from "../contexts/GameContext";

export function JoinRoomModal({ initialCode = "", onClose }) {
  const { gameService, enterRoom } = useGame();
  const [joinCode, setJoinCode] = useState(initialCode);
  const [status, setStatus] = useState({ message: "", type: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setJoinCode(initialCode || "");
  }, [initialCode]);

  const joinRoom = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      setStatus({ message: "Uniéndose...", type: "" });
      const { roomId } = await gameService.joinRoom(joinCode.trim());
      enterRoom(roomId);
      onClose();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content join-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>Unirse a sala</h3>
          <button type="button" className="btn btn-ghost profile-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="hint">Pega el código o abre un enlace de invitación.</p>
        <form onSubmit={joinRoom} className="join-form">
          <label>Código de sala</label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            required
            maxLength={6}
            placeholder="ABC123"
            autoFocus
            style={{ textTransform: "uppercase" }}
          />
          <button type="submit" className="btn btn-secondary btn-large" disabled={busy}>
            {busy ? "Uniéndose..." : "Unirse"}
          </button>
        </form>
        <p className={`status-message ${status.type}`}>{status.message}</p>
      </div>
    </div>
  );
}
