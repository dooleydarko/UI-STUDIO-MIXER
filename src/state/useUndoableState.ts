import { useCallback, useRef, useState } from 'react';

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UndoableState<T> {
  state: T;
  /** Replace state. Accepts a value or an updater, like React's setState. */
  set: (next: T | ((prev: T) => T), options?: { coalesceKey?: string }) => void;
  /** Replace state without creating an undo step (e.g. switching projects). */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 600;

/**
 * Typed history store. Rapid edits sharing a coalesceKey (e.g. dragging a slider)
 * merge into a single undo step.
 */
export function useUndoableState<T>(initial: T | (() => T)): UndoableState<T> {
  const [history, setHistory] = useState<History<T>>(() => ({
    past: [],
    present: typeof initial === 'function' ? (initial as () => T)() : initial,
    future: [],
  }));
  const lastEdit = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback<UndoableState<T>['set']>((next, options) => {
    setHistory((h) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(h.present) : next;
      if (Object.is(value, h.present)) return h;

      const now = Date.now();
      const key = options?.coalesceKey;
      const coalesce =
        !!key &&
        lastEdit.current?.key === key &&
        now - lastEdit.current.at < COALESCE_WINDOW_MS &&
        h.past.length > 0;
      lastEdit.current = key ? { key, at: now } : null;

      if (coalesce) return { past: h.past, present: value, future: [] };
      return {
        past: [...h.past, h.present].slice(-MAX_HISTORY),
        present: value,
        future: [],
      };
    });
  }, []);

  const reset = useCallback((next: T) => {
    lastEdit.current = null;
    setHistory({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    lastEdit.current = null;
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    lastEdit.current = null;
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  return {
    state: history.present,
    set,
    reset,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
