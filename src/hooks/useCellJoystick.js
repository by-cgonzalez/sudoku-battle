import { useCallback, useEffect, useRef, useState } from "react";
import { digitFromJoystickDelta } from "../components/DigitsJoystick";

const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 14;

/**
 * Long-press + slide digit joystick for touch devices.
 * Returns touch handlers to attach on each editable cell.
 */
function isTouchPrimary() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function useCellJoystick({
  enabled = true,
  onSelectCell,
  onCommitDigit,
  completedDigits = null,
  draftMode = false,
}) {
  const [joystick, setJoystick] = useState(null);
  const [touchUi, setTouchUi] = useState(false);
  const stateRef = useRef(null);
  const suppressClickRef = useRef(false);
  const callbacksRef = useRef({ onSelectCell, onCommitDigit, completedDigits, draftMode });

  useEffect(() => {
    callbacksRef.current = { onSelectCell, onCommitDigit, completedDigits, draftMode };
  }, [onSelectCell, onCommitDigit, completedDigits, draftMode]);

  useEffect(() => {
    setTouchUi(isTouchPrimary());
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const sync = () => setTouchUi(mq.matches);
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const clearTimer = () => {
    const s = stateRef.current;
    if (s?.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  };

  const dismiss = useCallback(() => {
    clearTimer();
    stateRef.current = null;
    setJoystick(null);
  }, []);

  const active = Boolean(enabled && touchUi);

  useEffect(() => {
    if (!active) dismiss();
  }, [active, dismiss]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  const bindCell = useCallback(
    (row, col, { fixed = false, blocked = false, editable = true } = {}) => {
      if (!active || blocked || !editable) {
        return {};
      }

      const onTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        clearTimer();
        const s = {
          row,
          col,
          fixed,
          startX: t.clientX,
          startY: t.clientY,
          active: false,
          digit: null,
          timer: null,
        };
        stateRef.current = s;
        s.timer = setTimeout(() => {
          if (stateRef.current !== s) return;
          s.active = true;
          const cb = callbacksRef.current;
          cb.onSelectCell?.(s.row, s.col, s.fixed, false);
          try {
            navigator.vibrate?.(12);
          } catch {
            /* ignore */
          }
          setJoystick({
            x: s.startX,
            y: s.startY,
            row: s.row,
            col: s.col,
            digit: null,
            draftMode: cb.draftMode,
            completedDigits: cb.completedDigits,
          });
        }, LONG_PRESS_MS);
      };

      const onTouchMove = (e) => {
        const s = stateRef.current;
        if (!s || s.row !== row || s.col !== col) return;
        const t = e.touches[0];
        if (!t) return;
        const dx = t.clientX - s.startX;
        const dy = t.clientY - s.startY;

        if (!s.active) {
          if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
            clearTimer();
            stateRef.current = null;
          }
          return;
        }

        e.preventDefault();
        const digit = digitFromJoystickDelta(dx, dy);
        s.digit = digit;
        const cb = callbacksRef.current;
        setJoystick((prev) =>
          prev
            ? {
                ...prev,
                x: s.startX,
                y: s.startY,
                digit,
                draftMode: cb.draftMode,
                completedDigits: cb.completedDigits,
              }
            : prev
        );
      };

      const onTouchEnd = (e) => {
        const s = stateRef.current;
        if (!s || s.row !== row || s.col !== col) return;

        if (!s.active) {
          clearTimer();
          stateRef.current = null;
          return;
        }

        e.preventDefault();
        const digit = s.digit;
        const cb = callbacksRef.current;
        suppressClickRef.current = true;
        setTimeout(() => {
          suppressClickRef.current = false;
        }, 400);
        dismiss();
        const done = cb.completedDigits;
        if (digit != null && !(done instanceof Set && done.has(digit))) {
          cb.onCommitDigit?.(row, col, digit);
          try {
            navigator.vibrate?.(8);
          } catch {
            /* ignore */
          }
        }
      };

      const onTouchCancel = () => {
        const s = stateRef.current;
        if (!s || s.row !== row || s.col !== col) return;
        dismiss();
      };

      return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel,
      };
    },
    [active, dismiss]
  );

  const wrapClick = useCallback((handler) => (e) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler?.(e);
  }, []);

  return { joystick, bindCell, wrapClick, dismiss };
}
