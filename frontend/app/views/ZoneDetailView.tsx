"use client";

import { useEffect, useRef, useState } from "react";
import { Frame } from "../components/Frame";
import { TriangleDownIcon, TriangleRightIcon } from "../components/icons";
import { DeleteZoneModal } from "../components/modals";
import { BulkAction, recordPanel } from "../components/RecordDetailsPanel";
import { RecordsTab } from "../components/RecordsTab";
import { Button, Container, InfoLink, useDisclosure } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { DnssecTab, RecoveryTab, TagsTab } from "../components/ZoneTabs";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { useDebounced, useResource } from "../lib/hooks";
import { paths, ZoneTab } from "../lib/router";
import type { DnsRecord, Zone } from "../lib/types";

export function ZoneDetailView({ zoneId, tab, record }: { zoneId: string; tab: ZoneTab; record?: number }) {
  const { api, go, notify } = useConsole();
  const zone = useZone(zoneId);
  const [filter, setFilter] = useState("");
  const query = useDebounced(filter, 250);
  const records = useResource(() => api.get<DnsRecord[]>(`/zones/${zoneId}/records?q=${encodeURIComponent(query)}`), [zoneId, query, api]);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [openSignal, setOpenSignal] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [bulkRequest, setBulkRequest] = useState<BulkAction | null>(null);
  const preselected = useRef<number | undefined>(undefined);

  // Selecting the first row reveals the details panel, like the console's split panel.
  const select = (next: Set<string | number>) => {
    if (next.size > 0 && selected.size === 0) setOpenSignal((value) => value + 1);
    setSelected(next);
  };

  // A search result can deep-link to a record: select it once the list has loaded.
  useEffect(() => {
    if (record === undefined || preselected.current === record || !records.data) return;
    if (records.data.some((entry) => entry.id === record)) {
      preselected.current = record;
      setSelected(new Set([record]));
      setOpenSignal((value) => value + 1);
    }
  }, [record, records.data]);

  // Reset per-zone state when navigating between hosted zones.
  useEffect(() => {
    setSelected(new Set());
    setFilter("");
  }, [zoneId]);

  const loaded = zone.data;
  const selectedRecords = (records.data ?? []).filter((entry) => selected.has(entry.id));
  const panel = loaded && tab === "records" ? recordPanel(loaded, selectedRecords, setBulkRequest) : undefined;
  const name = loaded ? displayName(loaded.name) : "Hosted zone";

  const removeZone = async () => {
    if (!loaded) return;
    try {
      await api.del(`/zones/${loaded.id}`);
      notify({ type: "success", header: `Successfully deleted hosted zone ${displayName(loaded.name)}.` }, 1);
      go(paths.zones());
    } catch (error) {
      setDeleting(false);
      notify({ type: "error", header: "Unable to delete the hosted zone", content: (error as Error).message });
    }
  };

  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name }]}
      activeNav="Hosted zones"
      tools={panel}
      openSignal={openSignal}
      helpTopic="hosted-zone-details"
    >
      <ZoneBoundary resource={zone}>
        {(current) => (
          <>
            <ZoneHeader zone={current} onDelete={() => setDeleting(true)} />
            <ZoneDetailsCard zone={current} />
            <Tabs zone={current} active={tab} />
            {tab === "records" && (
              <RecordsTab
                zone={current}
                records={records}
                filter={filter}
                onFilter={setFilter}
                selected={selected}
                onSelect={select}
                onChanged={zone.reload}
                bulkRequest={bulkRequest}
                onBulkHandled={() => setBulkRequest(null)}
              />
            )}
            {tab === "recovery" && <RecoveryTab zone={current} onChanged={zone.reload} />}
            {tab === "dnssec" && <DnssecTab zone={current} onChanged={zone.reload} />}
            {tab === "tags" && <TagsTab zone={current} onChanged={zone.reload} />}
            {deleting && <DeleteZoneModal zone={current} onCancel={() => setDeleting(false)} onConfirm={removeZone} />}
          </>
        )}
      </ZoneBoundary>
    </Frame>
  );
}

function ZoneHeader({ zone, onDelete }: { zone: Zone; onDelete: () => void }) {
  const { go } = useConsole();
  return (
    <header className="zone-header">
      <h1>
        <span className="zone-badge">{zone.private_zone ? "Private" : "Public"}</span>
        {displayName(zone.name)} <InfoLink topic="hosted-zone-details" />
      </h1>
      <div className="page-actions">
        <Button onClick={onDelete}>Delete zone</Button>
        <Button onClick={() => go(paths.testRecord(zone.id))}>Test record</Button>
        <Button onClick={() => go(paths.queryLogging(zone.id))}>Configure query logging</Button>
      </div>
    </header>
  );
}

function ZoneDetailsCard({ zone }: { zone: Zone }) {
  const { go } = useConsole();
  const { open, toggle } = useDisclosure(false);
  return (
    <Container className="details-card">
      <div className="details-head">
        <button type="button" className="disclosure disclosure-heading" aria-expanded={open} onClick={toggle}>
          {open ? <TriangleDownIcon size={13} /> : <TriangleRightIcon size={13} />} Hosted zone details
        </button>
        <Button onClick={() => go(paths.zoneEdit(zone.id))}>Edit hosted zone</Button>
      </div>
      {open && (
        <dl className="details-grid">
          <div className="details-col">
            <dt>Hosted zone name</dt>
            <dd>{displayName(zone.name)}</dd>
            <dt>Hosted zone ID</dt>
            <dd>{zone.id}</dd>
            <dt>Description</dt>
            <dd>{zone.comment || "-"}</dd>
          </div>
          <div className="details-col">
            <dt>Query log</dt>
            <dd>{zone.query_log_group || "-"}</dd>
            <dt>Type</dt>
            <dd>{zone.private_zone ? "Private hosted zone" : "Public hosted zone"}</dd>
            <dt>Record count</dt>
            <dd>{zone.record_count}</dd>
          </div>
          <div className="details-col">
            {zone.private_zone ? (
              <>
                <dt>Associated VPC</dt>
                <dd>{zone.vpc_id ? `${zone.vpc_id} (${zone.vpc_region})` : "-"}</dd>
              </>
            ) : (
              <>
                <dt>Name servers</dt>
                <dd>{zone.name_servers.length ? zone.name_servers.map((server) => <div key={server}>{displayName(server)}</div>) : "-"}</dd>
              </>
            )}
          </div>
        </dl>
      )}
    </Container>
  );
}

const TABS: { id: ZoneTab; label: (zone: Zone) => string }[] = [
  { id: "records", label: (zone) => `Records (${zone.record_count})` },
  { id: "recovery", label: () => "Accelerated recovery" },
  { id: "dnssec", label: () => "DNSSEC signing" },
  { id: "tags", label: (zone) => `Hosted zone tags (${zone.tags.length})` },
];

function Tabs({ zone, active }: { zone: Zone; active: ZoneTab }) {
  const { go } = useConsole();
  return (
    <div className="tabs" role="tablist" aria-label="Hosted zone sections">
      {TABS.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} className={`tab ${active === tab.id ? "active" : ""}`} onClick={() => go(paths.zone(zone.id, tab.id))}>
          {tab.label(zone)}
        </button>
      ))}
    </div>
  );
}
