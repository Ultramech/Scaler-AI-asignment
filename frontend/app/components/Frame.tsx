"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useConsole } from "../lib/console";
import { useDebounced } from "../lib/hooks";
import { FALLBACK_HELP, HELP } from "../lib/help";
import { paths, slugify } from "../lib/router";
import type { SearchResult } from "../lib/types";
import {
  AwsLogo,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ExternalIcon,
  GearIcon,
  GridIcon,
  HelpCircleIcon,
  InfoCircleIcon,
  MenuIcon,
  PanelIcon,
  SearchIcon,
  TerminalIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TriangleDownIcon,
  TriangleRightIcon,
} from "./icons";
import { Button, Flashbar, IconButton, Modal } from "./ui";

/* -------------------------------------------------------------------- top bar */

function useUnavailable() {
  const { notify } = useConsole();
  return (feature: string) => notify({ type: "info", header: `${feature} isn't available in this local Route 53 demo.` });
}

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Alt", "S"], action: "Focus the global search" },
  { keys: ["/"], action: "Focus the filter of the current table" },
  { keys: ["N"], action: "Create a record (hosted zone page)" },
  { keys: ["C"], action: "Create a hosted zone (hosted zones page)" },
  { keys: ["R"], action: "Refresh the current table" },
  { keys: ["?"], action: "Show keyboard shortcuts" },
  { keys: ["Esc"], action: "Close a dialog or clear the search" },
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Keyboard shortcuts"
      size="small"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.action}>
              <td>
                {shortcut.keys.map((key, index) => (
                  <span key={key}>
                    {index > 0 && " + "}
                    <kbd>{key}</kbd>
                  </span>
                ))}
              </td>
              <td>{shortcut.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function Topbar() {
  const { api, user, dark, toggleTheme, logout, go } = useConsole();
  const unavailable = useUnavailable();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [account, setAccount] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const input = useRef<HTMLInputElement>(null);
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

  const choose = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    go(paths.zone(result.zone_id, "records", result.record_id));
  };

  return (
    <header className="topbar">
      <button type="button" className="topbar-logo" aria-label="AWS Management Console home" onClick={() => go(paths.zones())}>
        <AwsLogo />
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
      <div className="account">
        <button type="button" className="account-button" aria-haspopup="menu" aria-expanded={account} onClick={() => setAccount(!account)} onBlur={() => setTimeout(() => setAccount(false), 120)}>
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
            <button type="button" role="menuitem" onClick={() => setShortcuts(true)}>
              Keyboard shortcuts
            </button>
            <button type="button" role="menuitem" onClick={toggleTheme}>
              {dark ? "Switch to light mode" : "Switch to dark mode"}
            </button>
            <button type="button" role="menuitem" onClick={logout}>
              Sign out
            </button>
          </div>
        )}
      </div>
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)} />}
    </header>
  );
}

/* ----------------------------------------------------------------- navigation */

type NavItem = { label: string; to?: string; isNew?: boolean };
const NAV: (NavItem | { group: string; items: NavItem[] })[] = [
  { label: "Dashboard", to: paths.dashboard() },
  { label: "Hosted zones", to: paths.zones() },
  { label: "Health checks" },
  { label: "Profiles" },
  { group: "Global Resolver", items: [{ label: "Global resolvers", isNew: true }, { label: "Shared DNS views", isNew: true }] },
  { group: "VPC Resolver", items: [{ label: "VPCs" }, { label: "Inbound endpoints" }, { label: "Outbound endpoints" }, { label: "Rules" }, { label: "Query logging" }, { label: "Outposts" }] },
  { group: "Domains", items: [{ label: "Registered domains" }, { label: "Requests" }] },
  { group: "IP-based routing", items: [{ label: "CIDR collections" }] },
  { group: "Traffic flow", items: [{ label: "Traffic policies" }, { label: "Policy records" }] },
];

const NAV_ITEMS = NAV.flatMap((entry) => ("group" in entry ? entry.items : [entry]));

/** Maps a placeholder route such as "health-checks" back to its sidebar label. */
export function navLabelForSlug(slug: string): string | undefined {
  return NAV_ITEMS.find((item) => slugify(item.label) === slug)?.label;
}

function Sidebar({ active, onCollapse }: { active?: string; onCollapse: () => void }) {
  const { go } = useConsole();
  const unavailable = useUnavailable();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const link = (item: NavItem) => (
    <a
      key={item.label}
      href={`#${item.to ?? paths.mock(slugify(item.label))}`}
      className={`nav-link ${active === item.label ? "active" : ""}`}
      aria-current={active === item.label ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        go(item.to ?? paths.mock(slugify(item.label)));
      }}
    >
      {item.label}
      {item.isNew && <span className="nav-new">New</span>}
    </a>
  );
  return (
    <nav className="sidebar" aria-label="Route 53 navigation">
      <div className="sidebar-title">
        <h2>Route 53</h2>
        <IconButton label="Collapse navigation" onClick={onCollapse}>
          <ChevronLeftIcon size={16} />
        </IconButton>
      </div>
      {NAV.map((entry) =>
        "group" in entry ? (
          <div key={entry.group} className="nav-group">
            <button type="button" className="nav-group-title" aria-expanded={!collapsed.includes(entry.group)} onClick={() => setCollapsed((current) => (current.includes(entry.group) ? current.filter((name) => name !== entry.group) : [...current, entry.group]))}>
              {collapsed.includes(entry.group) ? <TriangleRightIcon size={11} /> : <TriangleDownIcon size={11} />} {entry.group}
            </button>
            {!collapsed.includes(entry.group) && entry.items.map(link)}
          </div>
        ) : (
          link(entry)
        ),
      )}
      <div className="sidebar-external">
        <button type="button" onClick={() => unavailable("DNS Firewall")}>
          DNS Firewall <ExternalIcon size={12} />
        </button>
        <button type="button" onClick={() => unavailable("Application Recovery Controller")}>
          Application Recovery Controller <ExternalIcon size={12} />
        </button>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------- tools panel */

function HelpPanel({ topic, onClose }: { topic: string; onClose: () => void }) {
  const { notify } = useConsole();
  const content = HELP[topic] ?? FALLBACK_HELP;
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);
  return (
    <>
      <div className="tools-header">
        <h2>{content.title}</h2>
        <IconButton label="Close help panel" onClick={onClose}>
          <CloseIcon size={18} />
        </IconButton>
      </div>
      <div className="tools-body help-body">
        {content.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {content.important && (
          <>
            <h3>Important</h3>
            {content.important.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </>
        )}
        <h3>Was this content helpful?</h3>
        <div className="help-vote">
          <Button
            onClick={() => {
              setVoted("yes");
              notify({ type: "success", header: "Thanks for your feedback." });
            }}
            aria-pressed={voted === "yes"}
          >
            <ThumbsUpIcon size={14} /> Yes
          </Button>
          <Button
            onClick={() => {
              setVoted("no");
              notify({ type: "success", header: "Thanks for your feedback." });
            }}
            aria-pressed={voted === "no"}
          >
            <ThumbsDownIcon size={14} /> No
          </Button>
        </div>
        {content.learnMore && (
          <>
            <hr />
            <h3>
              Learn more <ExternalIcon size={13} />
            </h3>
            <a href="https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/" target="_blank" rel="noreferrer">
              {content.learnMore}
            </a>
          </>
        )}
      </div>
    </>
  );
}

function PanelPositionModal({ value, onConfirm, onCancel }: { value: "side" | "bottom"; onConfirm: (value: "side" | "bottom") => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Modal
      title="Split panel preferences"
      size="small"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm(draft)}>
            Confirm
          </Button>
        </>
      }
    >
      <fieldset>
        <legend>Panel position</legend>
        {(["side", "bottom"] as const).map((position) => (
          <label key={position} className="radio-row">
            <input type="radio" name="panel-position" checked={draft === position} onChange={() => setDraft(position)} />
            {position === "side" ? "Side" : "Bottom"}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- frame */

export type Crumb = { label: string; to?: string };

type FrameProps = {
  crumbs: Crumb[];
  /** Sidebar label to highlight. Pages without a side navigation start with it closed. */
  activeNav?: string;
  navOpen?: boolean;
  /** Page-specific right panel (e.g. record details). Falls back to the Info help panel. */
  tools?: { title: ReactNode; content: ReactNode };
  toolsOpen?: boolean;
  /** Opens the tools panel each time this number changes (e.g. when a row gets selected). */
  openSignal?: number;
  /** Help topic opened by the (i) button when the page has no tools of its own. */
  helpTopic?: string;
  /** Sticky action bar shown at the bottom of the content (form pages). */
  actionBar?: ReactNode;
  children: ReactNode;
};

export function Frame({ crumbs, activeNav, navOpen = true, tools, toolsOpen = false, openSignal = 0, helpTopic = "hosted-zones", actionBar, children }: FrameProps) {
  const { go, help, openHelp, closeHelp } = useConsole();
  const [nav, setNav] = useState(navOpen);
  const [toolsVisible, setToolsVisible] = useState(toolsOpen);
  const [position, setPosition] = useState<"side" | "bottom">("side");
  const [positionDialog, setPositionDialog] = useState(false);

  // On narrow screens the drawer overlays the page, so it starts closed there.
  useEffect(() => setNav(navOpen && window.matchMedia("(min-width: 1001px)").matches), [navOpen]);
  useEffect(() => setToolsVisible(toolsOpen), [toolsOpen]);
  useEffect(() => {
    if (openSignal) setToolsVisible(true);
  }, [openSignal]);
  useEffect(() => {
    try {
      setPosition(localStorage.getItem("r53-panel-position") === "bottom" ? "bottom" : "side");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (help) setToolsVisible(true);
  }, [help]);

  const showingHelp = help !== null || !tools;
  const panelOpen = toolsVisible;
  const togglePanel = () => {
    if (toolsVisible) {
      closeHelp();
      setToolsVisible(false);
    } else {
      if (!tools) openHelp(helpTopic);
      setToolsVisible(true);
    }
  };
  const splitBottom = !showingHelp && position === "bottom";

  return (
    <div className="app">
      <Topbar />
      <div className="crumb-bar">
        <IconButton label={nav ? "Close navigation drawer" : "Open navigation drawer"} className={`crumb-menu ${nav ? "active" : ""}`} onClick={() => setNav(!nav)}>
          <MenuIcon size={18} />
        </IconButton>
        <nav aria-label="Breadcrumbs">
          <ol className="crumbs">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`}>
                {index > 0 && <ChevronRightIcon size={12} className="crumb-sep" />}
                {crumb.to ? (
                  <a
                    href={`#${crumb.to}`}
                    onClick={(event) => {
                      event.preventDefault();
                      go(crumb.to!);
                    }}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <span className="crumb-spacer" />
        <IconButton label={tools ? "Toggle details panel" : "Toggle help panel"} className={`crumb-panel ${panelOpen ? "open" : ""}`} aria-pressed={panelOpen} onClick={togglePanel}>
          {tools ? <PanelIcon size={18} /> : <InfoCircleIcon size={18} />}
        </IconButton>
      </div>
      <div className={`frame-body ${splitBottom ? "split-bottom" : ""}`}>
        <div className="frame-row">
          {nav && <Sidebar active={activeNav} onCollapse={() => setNav(false)} />}
          <main className="content">
            <div className="content-inner">
              <Flashbar />
              {children}
            </div>
            {actionBar && <div className="action-bar">{actionBar}</div>}
          </main>
          {panelOpen && !splitBottom && (
            <aside className="tools" aria-label={showingHelp ? "Help panel" : "Details panel"}>
              {showingHelp ? (
                <HelpPanel
                  topic={help ?? helpTopic}
                  onClose={() => {
                    closeHelp();
                    if (!tools) setToolsVisible(false);
                  }}
                />
              ) : (
                <>
                  <div className="tools-header">
                    <h2>{tools!.title}</h2>
                    <div className="tools-header-actions">
                      <IconButton label="Panel preferences" onClick={() => setPositionDialog(true)}>
                        <GearIcon size={16} />
                      </IconButton>
                      <IconButton label="Close panel" onClick={() => setToolsVisible(false)}>
                        <ChevronRightIcon size={16} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="tools-body">{tools!.content}</div>
                </>
              )}
            </aside>
          )}
        </div>
        {panelOpen && splitBottom && (
          <aside className="tools tools-bottom" aria-label="Details panel">
            <div className="tools-header">
              <h2>{tools!.title}</h2>
              <div className="tools-header-actions">
                <IconButton label="Panel preferences" onClick={() => setPositionDialog(true)}>
                  <GearIcon size={16} />
                </IconButton>
                <IconButton label="Close panel" onClick={() => setToolsVisible(false)}>
                  <CloseIcon size={16} />
                </IconButton>
              </div>
            </div>
            <div className="tools-body">{tools!.content}</div>
          </aside>
        )}
      </div>
      <FrameFooter />
      {positionDialog && (
        <PanelPositionModal
          value={position}
          onCancel={() => setPositionDialog(false)}
          onConfirm={(next) => {
            setPosition(next);
            setPositionDialog(false);
            try {
              localStorage.setItem("r53-panel-position", next);
            } catch {
              /* ignore */
            }
          }}
        />
      )}
    </div>
  );
}

function FrameFooter() {
  const unavailable = useUnavailable();
  const item = (label: string, icon?: ReactNode) => (
    <button type="button" key={label} onClick={() => unavailable(label)}>
      {icon}
      {label}
    </button>
  );
  return (
    <footer className="frame-footer">
      <div>
        {item("CloudShell", <TerminalIcon size={14} />)}
        {item("Agent Toolkit for AWS", <PanelIcon size={14} />)}
        {item("Feedback")}
        {item("Language")}
      </div>
      <div>
        <span>© 2026, Amazon Web Services, Inc. or its affiliates.</span>
        {item("Privacy")}
        {item("Terms")}
        {item("Cookie preferences")}
      </div>
    </footer>
  );
}
