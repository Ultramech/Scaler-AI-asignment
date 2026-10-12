"use client";

import { useEffect, useRef, useState } from "react";
import { useConsole } from "../../lib/console";
import { useDebounced, useDismiss } from "../../lib/hooks";
import { paths } from "../../lib/router";
import type { SearchResult } from "../../lib/types";
import { AwsLogo, BellIcon, GridIcon, HelpCircleIcon, SearchIcon, TerminalIcon, TriangleDownIcon } from "../common/icons";
import { ShortcutsModal } from "./ShortcutsModal";
import { useUnavailable } from "./useUnavailable";

export function Topbar() {
  const { api, user, dark, toggleTheme, logout, go } = useConsole();
  const unavailable = useUnavailable();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [account, setAccount] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(query, 200);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    let current = true;
    setSearching(true);
    api
      .get<SearchResult[]>(`/search?q=${encodeURIComponent(debounced)}`)
      .then((found) => current && setResults(found))
      .catch(() => current && setResults([]))
      .finally(() => current && setSearching(false));
    return () => {
      current = false;
    };
  }, [debounced, api]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        input.current?.focus();
        return;
      }
      const target = event.target as HTMLElement;
      if (event.key === "?" && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && !document.querySelector(".modal")) {
        event.preventDefault();
        setShortcuts(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close the account menu on an outside click or Escape. (Closing on blur would race with the click on a menu item.)
  useDismiss(accountRef, account, setAccount);

  const choose = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    go(paths.zone(result.zone_id, "records", result.record_id));
  };

  return (
    <>
      <header className="topbar">
        <button type="button" className="topbar-logo" aria-label="AWS Management Console home" onClick={() => go(paths.zones())}>
          <AwsLogo width={46} />
        </button>
        <button type="button" className="topbar-icon topbar-q" aria-label="Amazon Q" onClick={() => unavailable("Amazon Q")}>
          <span />
        </button>
        <button type="button" className="topbar-icon" aria-label="Services" onClick={() => unavailable("The services menu")}>
          <GridIcon size={20} />
        </button>
        <div className="topbar-search" role="search">
          <SearchIcon size={16} />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
              if (event.key === "Enter" && results[0]) choose(results[0]);
            }}
            placeholder="Search"
            aria-label="Search hosted zones and records"
          />
          <kbd>[Alt+S]</kbd>
          <span className="search-badge" aria-hidden="true" />
          {query.trim() && (
            <div className="search-results" role="listbox">
              {results.length ? (
                results.map((result, index) => (
                  <button type="button" role="option" aria-selected={false} key={`${result.zone_id}-${result.record_id ?? "zone"}-${index}`} onClick={() => choose(result)}>
                    <strong>{result.label}</strong>
                    <small>
                      {result.kind} · {result.detail}
                    </small>
                  </button>
                ))
              ) : (
                <p>{searching ? "Searching…" : "No matching Route 53 resources"}</p>
              )}
            </div>
          )}
        </div>
        <div className="topbar-spacer" />
        <button type="button" className="topbar-icon" aria-label="CloudShell" onClick={() => unavailable("CloudShell")}>
          <TerminalIcon size={18} />
        </button>
        <button type="button" className="topbar-icon" aria-label="Notifications" onClick={() => unavailable("Notifications")}>
          <BellIcon size={18} />
        </button>
        <button type="button" className="topbar-icon" aria-label="Support" onClick={() => unavailable("Support")}>
          <HelpCircleIcon size={18} />
        </button>
        <div className="account" ref={accountRef}>
          <button type="button" className="account-button" aria-haspopup="menu" aria-expanded={account} onClick={() => setAccount(!account)}>
            <span>
              Demo account <TriangleDownIcon size={8} />
            </span>
            <small>{user.name}</small>
          </button>
          {account && (
            <div className="account-menu" role="menu">
              <p>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </p>
              <button type="button" role="menuitem" onClick={() => { setAccount(false); setShortcuts(true); }}>
                Keyboard shortcuts
              </button>
              <button type="button" role="menuitem" onClick={() => { setAccount(false); toggleTheme(); }}>
                {dark ? "Switch to light mode" : "Switch to dark mode"}
              </button>
              <button type="button" role="menuitem" onClick={() => { setAccount(false); logout(); }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
    </>
  );
}
