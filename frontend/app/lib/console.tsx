"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Api, createApi } from "./api";
import { navigate } from "./router";
import { readStorage, writeStorage } from "./storage";

type Flash = { id: number; type: "success" | "error" | "warning" | "info"; header: string; content?: string; survive: number };
type FlashInput = Omit<Flash, "id" | "survive">;

type ConsoleContextValue = {
  api: Api;
  user: { email: string; name: string };
  dark: boolean;
  toggleTheme: () => void;
  logout: () => void;
  flashes: Flash[];
  /** Shows a flash message. `survive` keeps it visible across that many navigations. */
  notify: (flash: FlashInput, survive?: number) => void;
  /** Shows a red banner with `header` and the error's message. */
  notifyError: (header: string, error: unknown) => void;
  dismiss: (id: number) => void;
  /** Navigates and clears flash messages that are not meant to survive the move. */
  go: (path: string) => void;
  help: string | null;
  openHelp: (topic: string) => void;
  closeHelp: () => void;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function useConsole() {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error("useConsole must be used inside <ConsoleProvider>");
  return value;
}

export function ConsoleProvider({ token, user, onLogout, children }: { token: string; user: ConsoleContextValue["user"]; onLogout: () => void; children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [help, setHelp] = useState<string | null>(null);

  useEffect(() => setDark(readStorage("r53-theme") === "dark"), []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const api = useMemo(() => createApi(token, onLogout), [token, onLogout]);

  const toggleTheme = useCallback(() => {
    setDark((current) => {
      writeStorage("r53-theme", current ? "light" : "dark");
      return !current;
    });
  }, []);

  const notify = useCallback((flash: FlashInput, survive = 0) => {
    setFlashes((current) => [{ ...flash, id: Date.now() + Math.random(), survive }, ...current].slice(0, 4));
  }, []);
  const notifyError = useCallback((header: string, error: unknown) => notify({ type: "error", header, content: (error as Error).message }), [notify]);
  const dismiss = useCallback((id: number) => setFlashes((current) => current.filter((flash) => flash.id !== id)), []);

  const go = useCallback((path: string) => {
    setFlashes((current) => current.filter((flash) => flash.survive > 0).map((flash) => ({ ...flash, survive: flash.survive - 1 })));
    setHelp(null);
    navigate(path);
  }, []);

  const value = useMemo(
    () => ({ api, user, dark, toggleTheme, logout: onLogout, flashes, notify, notifyError, dismiss, go, help, openHelp: setHelp, closeHelp: () => setHelp(null) }),
    [api, user, dark, toggleTheme, onLogout, flashes, notify, notifyError, dismiss, go, help],
  );
  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}
