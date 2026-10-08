"use client";

import { DependencyList, useCallback, useEffect, useRef, useState } from "react";

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export type Resource<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

/** Loads data whenever `deps` change. Out-of-order responses are discarded. */
export function useResource<T>(load: () => Promise<T>, deps: DependencyList): Resource<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    loadRef.current().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (error: Error) => current && setState((previous) => ({ data: previous.data, error: error.message, loading: false })),
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
  const [preferences, setPreferences] = useState<TablePreferences>(DEFAULT_PREFERENCES);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`r53-prefs-${key}`);
      if (saved) setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
    } catch {
      /* storage can be unavailable */
    }
  }, [key]);
  const update = useCallback(
    (next: TablePreferences) => {
      setPreferences(next);
      try {
        localStorage.setItem(`r53-prefs-${key}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [preferences, update];
}
