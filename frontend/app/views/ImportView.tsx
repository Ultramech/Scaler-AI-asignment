"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Column, DataTable, useSort } from "../components/DataTable";
import { Frame } from "../components/Frame";
import { PreferencesModal, searchModeSentence } from "../components/PreferencesModal";
import { Alert, Button, Container, PageHeader, Pagination, SearchInput } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { useDebounced, usePreferences } from "../lib/hooks";
import { paths } from "../lib/router";
import type { ImportPreview, Zone } from "../lib/types";

type PreviewRow = ImportPreview["records"][number];

const COLUMNS: Column<PreviewRow>[] = [
  { id: "name", header: "Record name", width: 300, sortValue: (row) => row.name, cell: (row) => displayName(row.name) },
  { id: "type", header: "Type", width: 160, sortValue: (row) => row.type, cell: (row) => row.type },
  {
    id: "value",
    header: "Value/Route traffic to",
    width: 340,
    sortValue: (row) => row.value,
    cell: (row) => row.value.split("\n").map((line, index) => <div key={index}>{line}</div>),
  },
  { id: "ttl", header: "TTL (seconds)", width: 200, sortValue: (row) => row.ttl, cell: (row) => row.ttl.toLocaleString() },
];

const EXAMPLE = "subdomain1 0s A 10.0.0.0\nsubdomain2 0s CNAME example.com.";

export function ImportView({ zoneId }: { zoneId: string }) {
  const zone = useZone(zoneId);
  const name = zone.data ? displayName(zone.data.name) : "Hosted zone";
  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name, to: paths.zone(zoneId) }, { label: "Import zone file" }]}
      navOpen={false}
      helpTopic="import-zone-file"
    >
      <ZoneBoundary resource={zone}>{(loaded) => <ImportForm zone={loaded} />}</ZoneBoundary>
    </Frame>
  );
}

function ImportForm({ zone }: { zone: Zone }) {
  const { api, go, notify } = useConsole();
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = usePreferences("import-preview");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(content, 300);

  useEffect(() => {
    if (!debounced.trim()) {
      setPreview(null);
      return;
    }
    let current = true;
    api
      .post<ImportPreview>(`/zones/${zone.id}/records/import/preview`, { content: debounced })
      .then((result) => current && setPreview(result))
      .catch((error: Error) => current && setPreview({ records: [], conflicts: [], error: error.message }));
    return () => {
      current = false;
    };
  }, [debounced, zone.id, api]);

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = preview?.records ?? [];
    return needle ? all.filter((row) => `${row.name} ${row.type} ${row.value} ${row.ttl}`.toLowerCase().includes(needle)) : all;
  }, [preview, filter]);
  const { sorted, sort, toggle } = useSort(rows, COLUMNS, { id: "name", desc: false });
  const pages = Math.max(1, Math.ceil(sorted.length / preferences.pageSize));
  const pageRows = sorted.slice((page - 1) * preferences.pageSize, page * preferences.pageSize);
  useEffect(() => setPage(1), [filter, preferences.pageSize, preview]);

  const canImport = Boolean(preview && !preview.error && preview.records.length && !preview.conflicts.length) && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ imported: number }>(`/zones/${zone.id}/records/import`, { content });
      notify({ type: "success", header: `Successfully imported ${result.imported} ${result.imported === 1 ? "record" : "records"} into ${displayName(zone.name)}.` }, 1);
      go(paths.zone(zone.id));
    } catch (error) {
      notify({ type: "error", header: "Unable to import the zone file", content: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-page import-page">
      <PageHeader title="Import zone file" info="import-zone-file" description="You can create records for a Route 53 hosted zone by importing a zone file." />
      <Container title="Zone file" description="Paste the contents of your zone file below.">
        <textarea className="text-input wide zone-file" rows={9} value={content} placeholder={EXAMPLE} spellCheck={false} aria-label="Zone file contents" onChange={(event) => setContent(event.target.value)} />
        <p className="field-hint">
          If the hosted zone already contains records that appear in the zone file, the import process fails, and no records are created. Enter multiple records on separate lines.{" "}
          <button type="button" className="inline-link" onClick={() => upload.current?.click()}>
            Upload a zone file
          </button>
        </p>
        <input
          ref={upload}
          type="file"
          hidden
          accept=".zone,.txt,.bind,text/plain"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) setContent(await file.text());
            event.target.value = "";
          }}
        />
        {preview?.error && (
          <Alert type="error" header="The zone file isn’t valid">
            {preview.error}
          </Alert>
        )}
        {preview && preview.conflicts.length > 0 && (
          <Alert type="error" header="The hosted zone already contains records from this file">
            {preview.conflicts.join(", ")}
          </Alert>
        )}
      </Container>
      <Container title={`Record preview for ${displayName(zone.name)} (${preview?.records.length ?? 0})`} description={`Route 53 creates the following records when you choose Import zone file. If you edit the contents of the zone file above, the table reflects your changes.`}>
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
        <DataTable
          label="Record preview"
          columns={COLUMNS}
          rows={pageRows}
          rowKey={(row) => `${row.name}|${row.type}`}
          sort={sort}
          onSort={toggle}
          hidden={preferences.hidden}
          wrapLines={preferences.wrapLines}
          empty={filter ? "No records match your filter." : "This table displays records based on the contents of your zone file."}
        />
      </Container>
      <div className="inline-actions">
        <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canImport} onClick={submit}>
          Import
        </Button>
      </div>
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
    </div>
  );
}
