"use client";

import { useState } from "react";
import { useConsole } from "../../lib/console";
import { paths, slugify } from "../../lib/router";
import { ChevronLeftIcon, ExternalIcon, TriangleDownIcon, TriangleRightIcon } from "../common/icons";
import { IconButton } from "../common/ui";
import { useUnavailable } from "./useUnavailable";

type NavItem = { label: string; to?: string; isNew?: boolean };
const NAV: (NavItem | { group: string; items: NavItem[] })[] = [
  { label: "Dashboard" },
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

export function Sidebar({ active, onCollapse }: { active?: string; onCollapse: () => void }) {
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
