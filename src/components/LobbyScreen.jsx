import { useEffect, useState } from "react";
import { useGame } from "../contexts/GameContext";
import { DIFFICULTIES, DEFAULT_DIFFICULTY, getDifficulty } from "../lib/difficulty";
import {
  BATTLE_MODES,
  DEFAULT_BATTLE_MODE,
  DEFAULT_GAME_OPTIONS,
  getBattleMode,
  normalizeGameOptions,
} from "../lib/features";
import { loadLobbyPrefs, saveLobbyPrefs } from "../lib/lobbyPrefs";
import { OptionsPanel } from "./OptionsPanel";

function MobilePicker({
  label,
  open,
  onToggle,
  summary,
  accent,
  children,
}) {
  return (
    <div className={`mobile-picker${open ? " open" : ""}`}>
      <span className="section-label">{label}</span>
      <button
        type="button"
        className="mobile-picker-trigger"
        style={accent ? { "--diff-accent": accent } : undefined}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="mobile-picker-summary">{summary}</span>
        <span className="mobile-picker-chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && <div className="mobile-picker-menu">{children}</div>}
    </div>
  );
}

export function LobbyScreen() {
  const { gameService, enterRoom } = useGame();
  const initialPrefs = loadLobbyPrefs();
  const [difficulty, setDifficulty] = useState(initialPrefs.difficulty || DEFAULT_DIFFICULTY);
  const [battleMode, setBattleMode] = useState(initialPrefs.battleMode || DEFAULT_BATTLE_MODE);
  const [options, setOptions] = useState(() => ({
    ...DEFAULT_GAME_OPTIONS,
    ...initialPrefs.options,
  }));
  const [status, setStatus] = useState({ message: "", type: "" });
  const [diffOpen, setDiffOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    saveLobbyPrefs({ difficulty, battleMode, options });
  }, [difficulty, battleMode, options]);

  useEffect(() => {
    if (battleMode === "zones" && options.hints) {
      setOptions((prev) => ({ ...prev, hints: false }));
    }
  }, [battleMode, options.hints]);

  const createRoom = async () => {
    if (creating) return;
    try {
      setCreating(true);
      setStatus({ message: "Creando sala...", type: "" });
      const { roomId } = await gameService.createRoom(
        difficulty,
        battleMode,
        normalizeGameOptions(options, battleMode)
      );
      enterRoom(roomId);
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
      setCreating(false);
    }
  };

  const selectedDiff = getDifficulty(difficulty);
  const selectedMode = getBattleMode(battleMode);

  const pickDifficulty = (id) => {
    setDifficulty(id);
    setDiffOpen(false);
  };

  const pickBattleMode = (id) => {
    setBattleMode(id);
    setModeOpen(false);
  };

  return (
    <section className="screen active lobby-screen">
      <div className="lobby-layout">
        <div className="lobby-main">
          <div className="lobby-hero">
            <h2>Elige tu batalla</h2>
            <p>
              Configura y crea una sala 1v1. Solitario, unirse, ranking e historial están en el
              menú del perfil.
            </p>
          </div>

          <div className={`card lobby-card create-room-card lobby-create-wide${creating ? " is-creating" : ""}`}>
            {creating && (
              <div className="create-room-loading" role="status" aria-live="polite">
                <div className="create-room-loading-card">
                  <span className="create-room-loading-spin" aria-hidden="true" />
                  <strong>Creando sala...</strong>
                </div>
              </div>
            )}
            <div className="create-room-header">
              <h2>Crear sala</h2>
              <p>Configura la partida e invita a tu rival.</p>
            </div>

            <div className="create-room-body">
              <div className="create-room-main">
                <div className="lobby-mobile-pickers">
                  <MobilePicker
                    label="Dificultad"
                    open={diffOpen}
                    onToggle={() => {
                      setDiffOpen((v) => !v);
                      setModeOpen(false);
                    }}
                    accent={selectedDiff.accent}
                    summary={
                      <>
                        <span className="mobile-picker-icon">{selectedDiff.icon}</span>
                        <span className="mobile-picker-text">
                          <strong>{selectedDiff.label}</strong>
                          <small>
                            ~{selectedDiff.cluesApprox} pistas · +{selectedDiff.winPoints} pts
                          </small>
                        </span>
                      </>
                    }
                  >
                    {Object.values(DIFFICULTIES).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`mobile-picker-option${difficulty === d.id ? " selected" : ""}`}
                        style={{ "--diff-accent": d.accent }}
                        onClick={() => pickDifficulty(d.id)}
                        disabled={creating}
                      >
                        <span className="mobile-picker-icon">{d.icon}</span>
                        <span className="mobile-picker-text">
                          <strong>{d.label}</strong>
                          <small>
                            ~{d.cluesApprox} pistas · +{d.winPoints} pts
                          </small>
                        </span>
                      </button>
                    ))}
                  </MobilePicker>

                  <MobilePicker
                    label="Modalidad battle"
                    open={modeOpen}
                    onToggle={() => {
                      setModeOpen((v) => !v);
                      setDiffOpen(false);
                    }}
                    summary={
                      <>
                        <span className="mobile-picker-icon">{selectedMode.icon}</span>
                        <span className="mobile-picker-text">
                          <strong>{selectedMode.label}</strong>
                          <small>{selectedMode.desc}</small>
                        </span>
                      </>
                    }
                  >
                    {Object.values(BATTLE_MODES).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`mobile-picker-option${battleMode === mode.id ? " selected" : ""}`}
                        onClick={() => pickBattleMode(mode.id)}
                        disabled={creating}
                      >
                        <span className="mobile-picker-icon">{mode.icon}</span>
                        <span className="mobile-picker-text">
                          <strong>{mode.label}</strong>
                          <small>{mode.desc}</small>
                        </span>
                      </button>
                    ))}
                  </MobilePicker>
                </div>

                <div className="lobby-desktop-pickers">
                  <label className="section-label">Dificultad</label>
                  <div className="difficulty-options">
                    {Object.values(DIFFICULTIES).map((d) => (
                      <label key={d.id} className={`difficulty-option diff-${d.id}`}>
                        <input
                          type="radio"
                          name="difficulty"
                          value={d.id}
                          checked={difficulty === d.id}
                          onChange={() => setDifficulty(d.id)}
                          disabled={creating}
                        />
                        <span
                          className="difficulty-card"
                          style={{ "--diff-accent": d.accent }}
                        >
                          <span className="difficulty-top">
                            <span className="difficulty-icon" aria-hidden="true">
                              {d.icon}
                            </span>
                            <span className="difficulty-name">{d.label}</span>
                          </span>
                          <span className="difficulty-meta">
                            ~{d.cluesApprox} pistas · +{d.winPoints} pts
                          </span>
                          <span className="difficulty-desc">{d.desc}</span>
                          <span className="difficulty-meter" aria-hidden="true">
                            <span
                              className="difficulty-meter-fill"
                              style={{
                                width: `${Math.round((d.cellsToRemove / 58) * 100)}%`,
                              }}
                            />
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <label className="section-label">Modalidad battle</label>
                  <div className="battle-options">
                    {Object.values(BATTLE_MODES).map((mode) => (
                      <label key={mode.id} className="battle-option" title={mode.desc}>
                        <input
                          type="radio"
                          name="battleMode"
                          value={mode.id}
                          checked={battleMode === mode.id}
                          onChange={() => setBattleMode(mode.id)}
                          disabled={creating}
                        />
                        <span className="battle-card">
                          <span className="battle-icon">{mode.icon}</span>
                          <span className="battle-copy">
                            <span className="battle-name">{mode.label}</span>
                            <span className="battle-desc">{mode.desc}</span>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="create-room-side">
                <OptionsPanel
                  options={options}
                  onChange={setOptions}
                  compact
                  battleMode={battleMode}
                  readOnly={creating}
                />
                <p className="hint options-hint">
                  {battleMode === "zones"
                    ? "Tablero compartido, sin hints. Elige tu color en la sala; quien cierre un bloque lo gana."
                    : "Quien invita define estas opciones. También aplican en solitario (menú del perfil)."}
                </p>
              </aside>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-large create-room-cta"
              onClick={createRoom}
              disabled={creating}
            >
              {creating ? "Creando sala..." : "Crear sala 1v1"}
            </button>
          </div>

          {status.type === "error" && status.message ? (
            <p className={`status-message lobby-status ${status.type}`}>{status.message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
