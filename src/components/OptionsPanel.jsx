import { useState } from "react";
import { GAME_OPTIONS, battleModeAllowsHints } from "../lib/features";

export function OptionsPanel({
  options,
  onChange,
  readOnly = false,
  title = "Panel Opciones",
  compact = false,
  collapsible = false,
  defaultOpen = false,
  battleMode = null,
}) {
  const [open, setOpen] = useState(defaultOpen || readOnly);
  const allowHints = battleModeAllowsHints(battleMode);

  const toggle = (id) => {
    if (readOnly || !onChange) return;
    if (id === "hints" && !allowHints) return;
    onChange({ ...options, [id]: !options[id] });
  };

  const visibleOptions = Object.values(GAME_OPTIONS).filter(
    (opt) => opt.id !== "hints" || allowHints
  );

  const enabledCount = visibleOptions.filter((opt) => options?.[opt.id]).length;
  const enabledLabels = visibleOptions
    .filter((opt) => options?.[opt.id])
    .map((opt) => opt.label);

  const list = (
    <ul className="options-list">
      {visibleOptions.map((opt) => {
        const enabled = Boolean(options?.[opt.id]);
        return (
          <li key={opt.id} className={`options-item ${enabled ? "on" : ""}`} title={opt.desc}>
            <label className="options-toggle" title={opt.desc}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={readOnly}
                onChange={() => toggle(opt.id)}
              />
              <span className="options-switch" aria-hidden="true" />
              <span className="options-copy">
                <span className="options-label">
                  <span className="options-icon">{opt.icon}</span>
                  {opt.label}
                  {compact && (
                    <span className="options-tip" aria-hidden="true" title={opt.desc}>
                      ?
                    </span>
                  )}
                </span>
                {!compact && <span className="options-desc">{opt.desc}</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );

  if (!collapsible) {
    return (
      <div className={`options-panel ${compact ? "compact" : ""} ${readOnly ? "readonly" : ""}`}>
        <h3 className="options-panel-title">{title}</h3>
        {list}
      </div>
    );
  }

  return (
    <div
      className={`options-panel collapsible ${open ? "open" : ""} ${compact ? "compact" : ""} ${readOnly ? "readonly" : ""}`}
    >
      <button
        type="button"
        className="options-panel-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="options-panel-toggle-main">
          <span className="options-panel-title">{title}</span>
          <span className="options-summary">
            {enabledCount === 0
              ? "Ninguna activa"
              : enabledLabels.join(" · ")}
          </span>
        </span>
        <span className="options-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <div className="options-panel-body">{list}</div>}
    </div>
  );
}
