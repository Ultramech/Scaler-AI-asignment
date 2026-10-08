"use client";

import { useState } from "react";
import { displayName } from "../lib/dns";
import type { DnsRecord, Zone } from "../lib/types";
import { Button, Field, Modal } from "./ui";

/** Deleting a hosted zone requires typing "delete", like the real console. */
export function DeleteZoneModal({ zone, onCancel, onConfirm }: { zone: Zone; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Delete hosted zone ${displayName(zone.name)}?`}
      size="medium"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={text !== "delete" || busy} onClick={confirm}>
            Delete
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text === "delete" && !busy) confirm();
        }}
      >
        <p>
          Delete the hosted zone permanently? This action cannot be undone. Your domain might become unavailable on the internet.
          {zone.record_count > 2 && ` The ${zone.record_count} records in this hosted zone will be deleted too.`}
        </p>
        <hr />
        <p className="confirm-label">
          <strong>
            To confirm that you want to delete the hosted zone, enter <em>delete</em> in the field.
          </strong>
        </p>
        <input className="text-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="delete" aria-label="Confirmation text" autoComplete="off" />
      </form>
    </Modal>
  );
}

export function DeleteRecordsModal({ records, onCancel, onConfirm }: { records: DnsRecord[]; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={records.length === 1 ? "Delete record?" : `Delete ${records.length} records?`}
      size="medium"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={confirm}>
            Delete
          </Button>
        </>
      }
    >
      <p>
        {records.length === 1 ? "The following record will be deleted permanently." : "The following records will be deleted permanently."} This action cannot be undone.
      </p>
      <ul className="delete-list">
        {records.map((record) => (
          <li key={record.id}>
            <strong>{displayName(record.name)}</strong> <span>{record.type}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Bonus bulk operation: set one TTL on every selected record. */
export function BulkTtlModal({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: (ttl: number) => Promise<void> }) {
  const [ttl, setTtl] = useState("300");
  const [busy, setBusy] = useState(false);
  const valid = /^\d+$/.test(ttl) && Number(ttl) <= 2147483647;
  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(Number(ttl));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Change TTL for ${count} records`}
      size="small"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={submit}>
            Apply
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) submit();
        }}
      >
        <Field label="TTL (seconds)" htmlFor="bulk-ttl" description="Alias records have no TTL and are left unchanged." hint="Recommended values: 60 to 172800 (two days)" error={valid ? undefined : "Enter a whole number of seconds."}>
          <input id="bulk-ttl" className="text-input" inputMode="numeric" value={ttl} onChange={(event) => setTtl(event.target.value)} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}
