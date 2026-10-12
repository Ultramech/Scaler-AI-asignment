"use client";

import { useConsole } from "../../lib/console";
import { displayName } from "../../lib/dns";
import type { Zone } from "../../lib/types";

/** Bonus feature: download the zone as JSON or a BIND zone file. */
export function ExportBar({ zone }: { zone: Zone }) {
  const { api, notify, notifyError } = useConsole();
  const download = async (format: "json" | "bind") => {
    try {
      const content = format === "json" ? JSON.stringify(await api.get(`/zones/${zone.id}/export?format=json`), null, 2) : await api.text(`/zones/${zone.id}/export?format=bind`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
      link.download = `${displayName(zone.name)}.${format === "json" ? "json" : "zone"}`;
      link.click();
      URL.revokeObjectURL(link.href);
      notify({ type: "success", header: `Exported ${displayName(zone.name)} as ${format === "json" ? "JSON" : "a BIND zone file"}.` });
    } catch (error) {
      notifyError("Export failed", error);
    }
  };
  return (
    <div className="export-bar">
      <button type="button" className="inline-link" onClick={() => download("json")}>
        Export JSON
      </button>
      <button type="button" className="inline-link" onClick={() => download("bind")}>
        Export BIND
      </button>
      <span>
        Press <kbd>?</kbd> for keyboard shortcuts.
      </span>
    </div>
  );
}
