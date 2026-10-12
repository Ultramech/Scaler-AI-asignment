"use client";

import { ReactNode, useEffect, useState } from "react";
import { useConsole } from "../../lib/console";
import { ChevronRightIcon, InfoCircleIcon, MenuIcon, PanelIcon, TerminalIcon } from "../common/icons";
import { Flashbar, IconButton } from "../common/ui";
import { HelpPanel } from "./HelpPanel";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useUnavailable } from "./useUnavailable";

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

  // On narrow screens the drawer overlays the page, so it starts closed there.
  useEffect(() => setNav(navOpen && window.matchMedia("(min-width: 1001px)").matches), [navOpen]);
  useEffect(() => setToolsVisible(toolsOpen), [toolsOpen]);
  useEffect(() => {
    if (openSignal) setToolsVisible(true);
  }, [openSignal]);
  useEffect(() => {
    if (help) setToolsVisible(true);
  }, [help]);

  const showingHelp = help !== null || !tools;
  const togglePanel = () => {
    if (toolsVisible) {
      closeHelp();
      setToolsVisible(false);
    } else {
      if (!tools) openHelp(helpTopic);
      setToolsVisible(true);
    }
  };

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
        <IconButton label={tools ? "Toggle details panel" : "Toggle help panel"} className={`crumb-panel ${toolsVisible ? "open" : ""}`} aria-pressed={toolsVisible} onClick={togglePanel}>
          {tools ? <PanelIcon size={18} /> : <InfoCircleIcon size={18} />}
        </IconButton>
      </div>
      <div className="frame-body">
        <div className="frame-row">
          {nav && <Sidebar active={activeNav} onCollapse={() => setNav(false)} />}
          <main className="content">
            <div className="content-inner">
              <Flashbar />
              {children}
            </div>
            {actionBar && <div className="action-bar">{actionBar}</div>}
          </main>
          {toolsVisible && (
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
      </div>
      <FrameFooter />
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
