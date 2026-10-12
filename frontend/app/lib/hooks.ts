"use client";

import { DependencyList, RefObject, useCallback, useEffect, useState } from "react";
import { readStorage, writeStorage } from "./storage";

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Closes a popup (calls `setOpen(false)`) on a click outside `ref` or on Escape, while it is open. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, setOpen]);
}

export type Resource<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

/** Loads data whenever `deps` change. Out-of-order responses are discarded. */
export function useResource<T>(load: () => Promise<T>, deps: DependencyList): Resource<T> {
  const [state, setState] = useState<Omit<Resource<T>, "reload">>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    load().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (error: Error) => current && setState((previous) => ({ ...previous, error: error.message, loading: false })),
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}

export type TablePreferences = {
  pageSize: 10 | 30 | 50 | 100;
  wrapLines: boolean;
  searchMode: "Automatic" | "Full" | "Fast";
  hidden: string[];
};

const DEFAULT_PREFERENCES: TablePreferences = { pageSize: 100, wrapLines: false, searchMode: "Automatic", hidden: [] };

/** Table preferences (page size, wrapping, search mode, visible columns) persisted per table. */
export function usePreferences(key: string): [TablePreferences, (next: TablePreferences) => void] {
  const storageKey = `r53-prefs-${key}`;
  const [preferences, setPreferences] = useState<TablePreferences>(DEFAULT_PREFERENCES);
  useEffect(() => {
    const saved = readStorage(storageKey);
    try {
      if (saved) setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
    } catch {
      /* ignore a corrupt saved value */
    }
  }, [storageKey]);
  const update = (next: TablePreferences) => {
    setPreferences(next);
    writeStorage(storageKey, JSON.stringify(next));
  };
  return [preferences, update];
}
