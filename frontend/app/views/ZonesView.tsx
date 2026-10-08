"use client";

import { useEffect, useMemo, useState } from "react";
import { Column, DataTable, useSort } from "../components/DataTable";
import { Frame } from "../components/Frame";
import { RefreshIcon } from "../components/icons";
import { DeleteZoneModal } from "../components/modals";
import { PreferencesModal, searchModeSentence } from "../components/PreferencesModal";
import { Alert, Button, InfoLink, Pagination, RoundIconButton, SearchInput } from "../components/ui";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { useDebounced, usePreferences, useResource } from "../lib/hooks";
import { paths } from "../lib/router";
import type { Zone } from "../lib/types";

const COLUMNS: Column<Zone>[] = [
  {
    id: "name",
    header: "Hosted zone name",
    width: 220,
    sortValue: (zone) => zone.name,
    cell: (zone) => <ZoneLink zone={zone} />,
  },
  { id: "type", header: "Type", width: 110, sortValue: (zone) => (zone.private_zone ? "Private" : "Public"), cell: (zone) => (zone.private_zone ? "Private" : "Public") },
  { id: "created_by", header: "Created by", width: 140, sortValue: () => "Route 53", cell: () => "Route 53" },
  { id: "record_count", header: "Record count", width: 130, sortValue: (zone) => zone.record_count, cell: (zone) => zone.record_count },
  { id: "description", header: "Description", width: 200, sortValue: (zone) => zone.comment, cell: (zone) => zone.comment || "-" },
  { id: "id", header: "Hosted zone ID", width: 220, sortValue: (zone) => zone.id, cell: (zone) => zone.id },
];

function ZoneLink({ zone }: { zone: Zone }) {
  const { go } = useConsole();
  return (
    <a
      className="table-link"
      href={`#${paths.zone(zone.id)}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        go(paths.zone(zone.id));
      }}
    >
      {displayName(zone.name)}
    </a>
  );
}

export function ZonesView() {
  const { api, go, notify } = useConsole();
  const [filter, setFilter] = useState("");
  const query = useDebounced(filter, 250);
  const zones = useResource(() => api.get<Zone[]>(`/zones?q=${encodeURIComponent(query)}`), [query, api]);
  const [preferences, setPreferences] = usePreferences("zones");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Zone | null>(null);

  const rows = zones.data ?? [];
  const { sorted, sort, toggle } = useSort(rows, COLUMNS, null);
  const pages = Math.max(1, Math.ceil(sorted.length / preferences.pageSize));
  const pageRows = useMemo(() => sorted.slice((page - 1) * preferences.pageSize, page * preferences.pageSize), [sorted, page, preferences.pageSize]);
  const selectedZone = rows.find((zone) => selected.has(zone.id)) ?? null;

  useEffect(() => setPage(1), [query, preferences.pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  useEffect(() => {
    // Forget a selection that no longer exists after a refresh or filter change.
    if (selected.size && !selectedZone) setSelected(new Set());
  }, [selected, selectedZone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || event.metaKey || event.ctrlKey || event.altKey || document.querySelector(".modal")) return;
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".filter-row input[type=search]")?.focus();
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        go(paths.zoneCreate());
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        zones.reload();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, zones.reload]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.del(`/zones/${deleting.id}`);
      notify({ type: "success", header: `Successfully deleted hosted zone ${displayName(deleting.name)}.` });
      setDeleting(null);
      setSelected(new Set());
      zones.reload();
    } catch (error) {
      setDeleting(null);
      notify({ type: "error", header: "Unable to delete the hosted zone", content: (error as Error).message });
    }
  };

  return (
    <Frame crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones" }]} activeNav="Hosted zones" helpTopic="hosted-zones">
      <div className="table-header">
        <div className="table-title">
          <h1>
            Hosted zones <span className="count">({rows.length})</span> <InfoLink topic="hosted-zones" />
          </h1>
        </div>
        <div className="table-actions">
          <RoundIconButton label="Refresh hosted zones" onClick={zones.reload}>
            <RefreshIcon size={16} />
          </RoundIconButton>
          <Button disabled={!selectedZone} onClick={() => selectedZone && go(paths.zone(selectedZone.id))}>
            View details
          </Button>
          <Button disabled={!selectedZone} onClick={() => selectedZone && go(paths.zoneEdit(selectedZone.id))}>
            Edit
          </Button>
          <Button disabled={!selectedZone} onClick={() => setDeleting(selectedZone)}>
            Delete
          </Button>
          <Button variant="primary" onClick={() => go(paths.zoneCreate())}>
            Create hosted zone
          </Button>
        </div>
      </div>
      <p className="mode-note">
        {searchModeSentence(preferences.searchMode)}{" "}
        <button type="button" className="inline-link" onClick={() => setPreferencesOpen(true)}>
          To change modes go to settings.
        </button>
      </p>
      <div className="filter-row">
        <SearchInput value={filter} onChange={setFilter} className="filter-wide" />
        <Pagination page={page} pages={pages} onChange={setPage} onSettings={() => setPreferencesOpen(true)} />
      </div>
      {zones.error && (
        <Alert type="error" header="Unable to load hosted zones" action={<Button onClick={zones.reload}>Retry</Button>}>
          {zones.error}
        </Alert>
      )}
      <DataTable
        label="Hosted zones"
        columns={COLUMNS}
        rows={pageRows}
        rowKey={(zone) => zone.id}
        rowLabel={(zone) => displayName(zone.name)}
        sort={sort}
        onSort={toggle}
        selection="single"
        selected={selected}
        onSelectionChange={setSelected}
        hidden={preferences.hidden}
        wrapLines={preferences.wrapLines}
        loading={zones.loading}
        empty={
          filter ? (
            <div className="empty-state">
              <strong>No matches</strong>
              <p>We can’t find a match for “{filter}”.</p>
              <Button onClick={() => setFilter("")}>Clear filter</Button>
            </div>
          ) : (
            <div className="empty-state">
              <strong>No hosted zones</strong>
              <p>You don’t have any hosted zones.</p>
              <Button onClick={() => go(paths.zoneCreate())}>Create hosted zone</Button>
            </div>
          )
        }
      />
      {preferencesOpen && (
        <PreferencesModal
          columns={COLUMNS}
          value={preferences}
          onCancel={() => setPreferencesOpen(false)}
          onConfirm={(next) => {
            setPreferences(next);
            setPreferencesOpen(false);
          }}
        />
      )}
      {deleting && <DeleteZoneModal zone={deleting} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </Frame>
  );
}
