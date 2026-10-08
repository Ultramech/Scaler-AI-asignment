"use client";

import { useSyncExternalStore } from "react";

/** Minimal hash router: the console lives at `#/hostedzones/...` so Back/Forward and deep links work. */
export type Route =
  | { name: "zones" }
  | { name: "zone-create" }
  | { name: "zone"; id: string; tab: ZoneTab; record?: number }
  | { name: "zone-edit"; id: string }
  | { name: "record-create"; id: string }
  | { name: "record-edit"; id: string; recordId: number }
  | { name: "import"; id: string }
  | { name: "query-logging"; id: string }
  | { name: "test-record"; id: string }
  | { name: "dashboard" }
  | { name: "mock"; slug: string };

export type ZoneTab = "records" | "recovery" | "dnssec" | "tags";
const TABS: ZoneTab[] = ["records", "recovery", "dnssec", "tags"];

export const paths = {
  zones: () => "/hostedzones",
  zoneCreate: () => "/hostedzones/create",
  zone: (id: string, tab: ZoneTab = "records", record?: number) => {
    const query = new URLSearchParams();
    if (tab !== "records") query.set("tab", tab);
    if (record !== undefined) query.set("record", String(record));
    const suffix = query.toString();
    return `/hostedzones/${id}${suffix ? "?" + suffix : ""}`;
  },
  zoneEdit: (id: string) => `/hostedzones/${id}/edit`,
  recordCreate: (id: string) => `/hostedzones/${id}/records/create`,
  recordEdit: (id: string, recordId: number) => `/hostedzones/${id}/records/${recordId}/edit`,
  importZoneFile: (id: string) => `/hostedzones/${id}/import`,
  queryLogging: (id: string) => `/hostedzones/${id}/query-logging`,
  testRecord: (id: string) => `/hostedzones/${id}/test-record`,
  dashboard: () => "/dashboard",
  mock: (slug: string) => `/${slug}`,
};

export function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseRoute(hash: string): Route {
  const [pathname, search = ""] = hash.replace(/^#/, "").split("?");
  const query = new URLSearchParams(search);
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0 || (parts[0] === "hostedzones" && parts.length === 1)) return { name: "zones" };
  if (parts[0] === "dashboard") return { name: "dashboard" };
  if (parts[0] !== "hostedzones") return { name: "mock", slug: parts[0] };
  if (parts[1] === "create") return { name: "zone-create" };
  const id = parts[1];
  const rest = parts.slice(2).join("/");
  if (rest === "") {
    const tab = TABS.find((candidate) => candidate === query.get("tab")) ?? "records";
    const record = query.get("record");
    return { name: "zone", id, tab, record: record ? Number(record) : undefined };
  }
  if (rest === "edit") return { name: "zone-edit", id };
  if (rest === "records/create") return { name: "record-create", id };
  if (rest === "import") return { name: "import", id };
  if (rest === "query-logging") return { name: "query-logging", id };
  if (rest === "test-record") return { name: "test-record", id };
  const edit = rest.match(/^records\/(\d+)\/edit$/);
  if (edit) return { name: "record-edit", id, recordId: Number(edit[1]) };
  return { name: "zones" };
}

export function navigate(path: string) {
  if (location.hash === "#" + path) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = path;
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

/** The raw hash is the snapshot so React compares a stable string, then it is parsed on render. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => location.hash, () => "");
}

export function useRoute(): Route {
  return parseRoute(useHash());
}
