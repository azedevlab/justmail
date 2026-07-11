"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useHotkey — bind a keyboard shortcut. Follows Linear conventions:
 * single-letter binds fire outside inputs; `⌘`/Ctrl combos fire anywhere.
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: { allowInInput?: boolean; deps?: unknown[] } = {},
) {
  const cb = useRef(handler);
  cb.current = handler;
  const deps = options.deps ?? [];
  useEffect(() => {
    const parts = combo.toLowerCase().split("+");
    const key = parts.pop()!;
    const meta = parts.includes("meta") || parts.includes("cmd");
    const ctrl = parts.includes("ctrl") || parts.includes("control");
    const shift = parts.includes("shift");
    const alt = parts.includes("alt") || parts.includes("option");
    const listener = (e: KeyboardEvent) => {
      if (
        !options.allowInInput &&
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      )
        return;
      if (e.key.toLowerCase() !== key) return;
      if (meta !== e.metaKey) return;
      if (ctrl !== e.ctrlKey) return;
      if (shift !== e.shiftKey) return;
      if (alt !== e.altKey) return;
      e.preventDefault();
      cb.current(e);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, ...deps]);
}

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = v instanceof Function ? v(prev) : v;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [key],
  );
  return [value, update];
}

export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function useIsomorphicId(prefix = "jm") {
  const [id] = useState(
    () => `${prefix}-${Math.random().toString(36).slice(2, 10)}`,
  );
  return id;
}
