import { createPortal } from "react-dom";

const JOYSTICK_CELL = 52;
const DEADZONE = 18;

const DIGIT_GRID = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

/** Map finger delta from center to digit 1–9, or null if in dead zone / outside pad. */
export function digitFromJoystickDelta(dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < DEADZONE) return null;

  const half = JOYSTICK_CELL * 1.5;
  if (Math.abs(dx) > half || Math.abs(dy) > half) {
    // Clamp to nearest edge cell of the 3×3 pad
  }

  const gx = Math.max(-1, Math.min(1, Math.round(dx / JOYSTICK_CELL)));
  const gy = Math.max(-1, Math.min(1, Math.round(dy / JOYSTICK_CELL)));
  return DIGIT_GRID[gy + 1][gx + 1];
}

export function DigitsJoystick({
  x,
  y,
  activeDigit,
  completedDigits = null,
  draftMode = false,
}) {
  const done = completedDigits instanceof Set ? completedDigits : new Set();

  return createPortal(
    <div
      className={`digit-joystick${draftMode ? " draft" : ""}`}
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <div className="digit-joystick-pad">
        {DIGIT_GRID.map((row) =>
          row.map((n) => {
            const complete = done.has(n);
            const active = activeDigit === n;
            return (
              <span
                key={n}
                className={[
                  "digit-joystick-key",
                  active && "active",
                  complete && "digit-complete",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {n}
              </span>
            );
          })
        )}
      </div>
      <span className="digit-joystick-hint">
        {activeDigit ? `Soltar → ${activeDigit}` : "Desliza al número"}
      </span>
    </div>,
    document.body
  );
}

export const JOYSTICK_CELL_PX = JOYSTICK_CELL;
