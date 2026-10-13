"use client";

import { useEffect, useState } from "react";

/** Minimal hash router: the console lives at `#/hostedzones/...` so Back/Forward and deep links work. */
export type Route =
  | { name: "zones" }
  | { name: "zone-create" }
  | { name: "zone"; id: string; tab: ZoneTab; record?: number }
  | { name: "zone-edit"; id: string }
  | { name: "record-create"; id: string }
  | { name: "record-edit"; id: string; recordId: number }
  | { name: "import"; id: string }
  | { name: "mock"; slug: string };

const TABS = ["records", "tags"] as const;
export type ZoneTab = (typeof TABS)[number];

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
  mock: (slug: string) => `/${slug}`,
};

export function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseRoute(hash: string): Route {
  const [pathname, search = ""] = hash.replace(/^#/, "").split("?");
  const query = new URLSearchParams(search);
  const parts = pathname.split("/").filter(Boolean);
  const [section, id] = parts;
  if (!section || (section === "hostedzones" && !id)) return { name: "zones" };
  if (section !== "hostedzones") return { name: "mock", slug: section };
  if (id === "create") return { name: "zone-create" };
  const rest = parts.slice(2).join("/");
  if (rest === "") {
    const tab = TABS.find((candidate) => candidate === query.get("tab")) ?? "records";
    const record = query.get("record");
    return { name: "zone", id, tab, record: record ? Number(record) : undefined };
  }
  if (rest === "edit") return { name: "zone-edit", id };
  if (rest === "records/create") return { name: "record-create", id };
  if (rest === "import") return { name: "import", id };
  const edit = rest.match(/^records\/(\d+)\/edit$/);
  if (edit) return { name: "record-edit", id, recordId: Number(edit[1]) };
  return { name: "zones" };
}

export function navigate(path: string) {
  if (location.hash === "#" + path) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = path;
}

/** The current page, read from the URL hash and kept up to date when the hash changes. */
export function useRoute(): Route {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return parseRoute(hash);
}
