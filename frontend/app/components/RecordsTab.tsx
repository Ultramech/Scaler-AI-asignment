"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConsole } from "../lib/console";
import { displayName, FILTER_TYPES, recordTtl, ROUTING_POLICIES } from "../lib/dns";
import { Resource, usePreferences } from "../lib/hooks";
import { paths } from "../lib/router";
import type { DnsRecord, Zone } from "../lib/types";
import { Column, DataTable, useSort } from "./DataTable";
import { RefreshIcon, TriangleDownIcon } from "./icons";
import { BulkTtlModal, DeleteRecordsModal } from "./modals";
import type { BulkAction } from "./RecordDetailsPanel";
import { PreferencesModal, searchModeSentence } from "./PreferencesModal";
import { Alert, Button, Container, InfoLink, Pagination, RoundIconButton, SearchInput } from "./ui";

const multiline = (value: string) => value.split("\n").map((line, index) => <div key={index}>{line}</div>);

const COLUMNS: Column<DnsRecord>[] = [
  { id: "name", header: "Record name", width: 300, sortValue: (r) => r.name, cell: (r) => displayName(r.name) },
  { id: "type", header: "Type", width: 90, sortValue: (r) => r.type, cell: (r) => r.type },
  { id: "routing_policy", header: "Routing policy", width: 110, sortValue: (r) => r.routing_policy, cell: (r) => r.routing_policy },
  { id: "differentiator", header: "Differentiator", width: 110, cell: () => "-" },
  { id: "alias", header: "Alias", width: 90, sortValue: (r) => (r.alias ? "Yes" : "No"), cell: (r) => (r.alias ? "Yes" : "No") },
  { id: "value", header: "Value/Route traffic to", width: 320, sortValue: (r) => r.value, cell: (r) => multiline(r.value) },
  { id: "ttl", header: "TTL (seconds)", width: 110, sortValue: (r) => r.ttl, cell: recordTtl },
  { id: "health_check", header: "Health check ID", width: 110, cell: () => "-" },
  { id: "evaluate", header: "Evaluate target health", width: 110, sortValue: (r) => (r.alias ? (r.evaluate_target_health ? 1 : 0) : -1), cell: (r) => (r.alias ? (r.evaluate_target_health ? "Yes" : "No") : "-") },
  { id: "record_id", header: "Record ID", width: 110, sortValue: (r) => r.set_identifier, cell: (r) => r.set_identifier || "-" },
];

type Props = {
  zone: Zone;
  records: Resource<DnsRecord[]>;
  filter: string;
  onFilter: (value: string) => void;
  selected: Set<string | number>;
  onSelect: (selected: Set<string | number>) => void;
  /** Called after a record has been deleted so the zone's record count refreshes. */
  onChanged: () => void;
  /** Bulk action requested from the details panel; the tab opens the matching dialog. */
  bulkRequest: BulkAction | null;
  onBulkHandled: () => void;
};

export function RecordsTab({ zone, records, filter, onFilter, selected, onSelect, onChanged, bulkRequest, onBulkHandled }: Props) {
  const { api, go, notify } = useConsole();
  const [type, setType] = useState("");
  const [policy, setPolicy] = useState("");
  const [alias, setAlias] = useState("");
  const [page, setPage] = useState(1);
  const [preferences, setPreferences] = usePreferences("records");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [deleting, setDeleting] = useState<DnsRecord[] | null>(null);
  const [changingTtl, setChangingTtl] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  const all = records.data ?? [];
  const filtered = useMemo(
    () => all.filter((record) => (!type || record.type === type) && (!policy || record.routing_policy === policy) && (!alias || (alias === "Yes") === record.alias)),
    [all, type, policy, alias],
  );
  const { sorted, sort, toggle } = useSort(filtered, COLUMNS, null);
  const pages = Math.max(1, Math.ceil(sorted.length / preferences.pageSize));
  const pageRows = sorted.slice((page - 1) * preferences.pageSize, page * preferences.pageSize);
  const selectedRecords = all.filter((record) => selected.has(record.id));
  const hasProtected = selectedRecords.some((record) => record.protected);

  useEffect(() => {
    if (!bulkRequest) return;
    if (bulkRequest === "delete") setDeleting(selectedRecords);
    else setChangingTtl(true);
    onBulkHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkRequest]);

  useEffect(() => setPage(1), [filter, type, policy, alias, preferences.pageSize]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || event.metaKey || event.ctrlKey || event.altKey || document.querySelector(".modal")) return;
      if (event.key === "/") {
        event.preventDefault();
        search.current?.focus();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        go(paths.recordCreate(zone.id));
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        records.reload();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, zone.id, records.reload]);

  const remove = async () => {
    if (!deleting) return;
    try {
      if (deleting.length === 1) await api.del(`/records/${deleting[0].id}`);
      else await api.del(`/zones/${zone.id}/records`, { ids: deleting.map((record) => record.id) });
      notify({ type: "success", header: deleting.length === 1 ? "Successfully deleted the record." : `Successfully deleted ${deleting.length} records.` });
      setDeleting(null);
      onSelect(new Set());
      records.reload();
      onChanged();
    } catch (error) {
      setDeleting(null);
      notify({ type: "error", header: "Unable to delete the record", content: (error as Error).message });
    }
  };

  const changeTtl = async (ttl: number) => {
    try {
      const result = await api.patch<{ updated: number; skipped: number }>(`/zones/${zone.id}/records`, { ids: selectedRecords.map((record) => record.id), ttl });
      notify({
        type: "success",
        header: `Updated the TTL of ${result.updated} ${result.updated === 1 ? "record" : "records"}.`,
        content: result.skipped ? `${result.skipped} alias ${result.skipped === 1 ? "record has" : "records have"} no TTL and ${result.skipped === 1 ? "was" : "were"} skipped.` : undefined,
      });
      setChangingTtl(false);
      records.reload();
    } catch (error) {
      setChangingTtl(false);
      notify({ type: "error", header: "Unable to change the TTL", content: (error as Error).message });
    }
  };

  const filtersActive = Boolean(filter || type || policy || alias);
  const count = selected.size ? `${selected.size}/${all.length}` : String(filtered.length);

  return (
    <Container
      className="records-card"
      title={
        <>
          Records <span className="count">({count})</span> <InfoLink topic="records" />
        </>
      }
      actions={
        <>
          <RoundIconButton label="Refresh records" onClick={records.reload}>
            <RefreshIcon size={16} />
          </RoundIconButton>
          <Button disabled={!selected.size || hasProtected} onClick={() => setDeleting(selectedRecords)}>
            Delete record
          </Button>
          <Button onClick={() => go(paths.importZoneFile(zone.id))}>Import zone file</Button>
          <Button variant="primary" onClick={() => go(paths.recordCreate(zone.id))}>
            Create record
          </Button>
        </>
      }
      description={
        hasProtected ? (
          <>The following table lists the existing records in {displayName(zone.name)}. You can’t delete the SOA record or the NS record named {displayName(zone.name)}.</>
        ) : (
          <>
            {searchModeSentence(preferences.searchMode)}{" "}
            <button type="button" className="inline-link" onClick={() => setPreferencesOpen(true)}>
              To change modes go to settings.
            </button>
          </>
        )
      }
    >
      {records.error && (
        <Alert type="error" header="Unable to load records" action={<Button onClick={records.reload}>Retry</Button>}>
          {records.error}
        </Alert>
      )}
      <div className="filter-row">
        <div className="filter-group">
          <SearchInput value={filter} onChange={onFilter} inputRef={search} className="filter-search" />
          <FilterSelect label="Type" value={type} onChange={setType} options={FILTER_TYPES.map((entry) => ({ value: entry, label: entry }))} />
          <FilterSelect label="Routing policy" value={policy} onChange={setPolicy} options={ROUTING_POLICIES.map((entry) => ({ value: entry.value, label: entry.value }))} />
          <FilterSelect label="Alias" value={alias} onChange={setAlias} options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]} />
        </div>
        <Pagination page={page} pages={pages} onChange={setPage} onSettings={() => setPreferencesOpen(true)} />
      </div>
      <DataTable
        label="Records"
        columns={COLUMNS}
        rows={pageRows}
        rowKey={(record) => record.id}
        rowLabel={(record) => `${displayName(record.name)} ${record.type}`}
        sort={sort}
        onSort={toggle}
        selection="multiple"
        selected={selected}
        onSelectionChange={onSelect}
        hidden={preferences.hidden}
        wrapLines={preferences.wrapLines}
        loading={records.loading && !records.data}
        empty={
          filtersActive ? (
            <div className="empty-state">
              <strong>No matches</strong>
              <p>We can’t find a match for your filters.</p>
              <Button
                onClick={() => {
                  onFilter("");
                  setType("");
                  setPolicy("");
                  setAlias("");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="empty-state">
              <strong>No records</strong>
              <p>This hosted zone has no records.</p>
              <Button onClick={() => go(paths.recordCreate(zone.id))}>Create record</Button>
            </div>
          )
        }
      />
      <ExportBar zone={zone} />
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
      {changingTtl && <BulkTtlModal count={selectedRecords.length} onCancel={() => setChangingTtl(false)} onConfirm={changeTtl} />}
      {deleting && <DeleteRecordsModal records={deleting} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </Container>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="filter-select">
      <select aria-label={label} value={value} className={value ? "has-value" : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <TriangleDownIcon size={10} className="select-caret" />
    </div>
  );
}

/** Bonus feature: download the zone as JSON or a BIND zone file. */
function ExportBar({ zone }: { zone: Zone }) {
  const { api, notify } = useConsole();
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
      notify({ type: "error", header: "Export failed", content: (error as Error).message });
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
