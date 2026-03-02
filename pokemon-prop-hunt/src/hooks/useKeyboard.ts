import { useEffect, useRef, useCallback } from 'react';

// ============================================
// Keyboard Input Hook — frame-perfect input
// ============================================

interface KeyMap {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  reload: boolean;
  interact: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  scoreboard: boolean;
}

const KEY_BINDINGS: Record<string, keyof KeyMap> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyR: 'reload',
  KeyF: 'interact',
  KeyQ: 'rotateLeft',
  KeyE: 'rotateRight',
  Tab: 'scoreboard',
};

const DEFAULT_KEYS: KeyMap = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  reload: false,
  interact: false,
  rotateLeft: false,
  rotateRight: false,
  scoreboard: false,
};

export function useKeyboard() {
  const keysRef = useRef<KeyMap>({ ...DEFAULT_KEYS });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default for game keys
    if (e.code in KEY_BINDINGS) {
      e.preventDefault();
      const action = KEY_BINDINGS[e.code];
      keysRef.current[action] = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code in KEY_BINDINGS) {
      e.preventDefault();
      const action = KEY_BINDINGS[e.code];
      keysRef.current[action] = false;
    }
  }, []);

  // Handle window blur — release all keys
  const handleBlur = useCallback(() => {
    keysRef.current = { ...DEFAULT_KEYS };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);

  return keysRef;
}
