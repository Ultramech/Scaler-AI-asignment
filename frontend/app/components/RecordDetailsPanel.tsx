"use client";

import { displayName, recordTtl } from "../lib/dns";
import type { DnsRecord, Zone } from "../lib/types";
import { useConsole } from "../lib/console";
import { paths } from "../lib/router";
import { Button, CopyButton } from "./ui";

export type BulkAction = "ttl" | "delete";

/** Content of the right-hand panel on the hosted zone page. */
export function recordPanel(zone: Zone, records: DnsRecord[], onBulk: (action: BulkAction) => void) {
  if (records.length === 1) return { title: "Record details", content: <RecordDetails zone={zone} record={records[0]} /> };
  if (records.length > 1) {
    return {
      title: `${records.length} records selected`,
      content: (
        <div className="bulk-actions">
          <p className="muted">Select a single record to see its details, or apply an action to all {records.length} selected records.</p>
          <Button onClick={() => onBulk("ttl")}>Change TTL</Button>
          <Button disabled={records.some((record) => record.protected)} onClick={() => onBulk("delete")}>
            Delete records
          </Button>
        </div>
      ),
    };
  }
  return { title: "0 records selected", content: <p className="muted">Select a record to see its details</p> };
}

function RecordDetails({ zone, record }: { zone: Zone; record: DnsRecord }) {
  const { go } = useConsole();
  return (
    <div className="record-details">
      <Button onClick={() => go(paths.recordEdit(zone.id, record.id))}>Edit record</Button>
      <dl>
        <dt>Record name</dt>
        <dd>
          <CopyButton text={displayName(record.name)} label="Copy record name" /> {displayName(record.name)}
        </dd>
        <dt>Record type</dt>
        <dd>{record.type}</dd>
        <dt>{record.alias ? "Alias target" : "Value"}</dt>
        {record.value.split("\n").map((line, index) => (
          <dd key={index}>
            <CopyButton text={line} label="Copy value" /> {line}
          </dd>
        ))}
        <dt>Alias</dt>
        <dd>{record.alias ? "Yes" : "No"}</dd>
        {record.alias && (
          <>
            <dt>Evaluate target health</dt>
            <dd>{record.evaluate_target_health ? "Yes" : "No"}</dd>
          </>
        )}
        <dt>TTL (seconds)</dt>
        <dd>{recordTtl(record)}</dd>
        <dt>Routing policy</dt>
        <dd>{record.routing_policy}</dd>
        {record.set_identifier && (
          <>
            <dt>Record ID</dt>
            <dd>{record.set_identifier}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
