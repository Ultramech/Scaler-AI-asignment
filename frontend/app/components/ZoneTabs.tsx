"use client";

import { useMemo, useState } from "react";
import { useConsole } from "../lib/console";
import { formatDate } from "../lib/dns";
import type { Tag, Zone } from "../lib/types";
import { Column, DataTable, useSort } from "./DataTable";
import { Alert, Button, Container, Field, Modal, Pagination, SearchInput, StatusIndicator } from "./ui";
import { hasDuplicateTags, TagEditor } from "./TagEditor";

type TabProps = { zone: Zone; onChanged: () => void };

/* ---------------------------------------------------------------- recovery */

export function RecoveryTab({ zone, onChanged }: TabProps) {
  const { api, notify } = useConsole();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await api.put(`/zones/${zone.id}/accelerated-recovery`, { enabled: !zone.accelerated_recovery });
      notify({ type: "success", header: zone.accelerated_recovery ? "Accelerated recovery disabled." : "Accelerated recovery enabled." });
      onChanged();
    } catch (error) {
      notify({ type: "error", header: "Unable to update accelerated recovery", content: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Container
      title="Accelerated recovery"
      info="accelerated-recovery"
      actions={
        <Button disabled={busy || zone.private_zone} onClick={toggle}>
          {zone.accelerated_recovery ? "Disable" : "Enable"}
        </Button>
      }
      description="Enable the accelerated recovery option to ensure that you can continue to make changes to your public DNS records after an impairment to US East (N. Virginia)."
    >
      <dl className="read-only single">
        <dt>Status</dt>
        <dd>
          {zone.accelerated_recovery ? <StatusIndicator kind="success">Enabled</StatusIndicator> : <StatusIndicator kind="stopped">Disabled</StatusIndicator>}
        </dd>
      </dl>
      {zone.private_zone && <p className="field-hint">Accelerated recovery is only available for public hosted zones.</p>}
    </Container>
  );
}

/* ------------------------------------------------------------------ dnssec */

type Key = Zone["dnssec"]["keys"][number];

export function DnssecTab({ zone, onChanged }: TabProps) {
  const { api, notify } = useConsole();
  const [dismissed, setDismissed] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [viewing, setViewing] = useState<Key | null>(null);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const signing = zone.dnssec.enabled;

  const columns = useMemo<Column<Key>[]>(() => {
    const base: Column<Key>[] = [
      { id: "name", header: "Name", width: 320, sortValue: (key) => key.name, cell: (key) => key.name },
      { id: "status", header: "Status", width: 200, sortValue: (key) => key.status, cell: (key) => <StatusIndicator kind="success">{key.status}</StatusIndicator> },
      { id: "created", header: "Creation date", width: 240, sortValue: (key) => key.created_at ?? "", cell: (key) => formatDate(key.created_at) },
    ];
    return advanced
      ? [...base, { id: "algorithm", header: "Signing algorithm", width: 200, cell: () => "ECDSAP256SHA256 (13)" }, { id: "kms", header: "KMS key", width: 280, cell: () => "alias/route53-dnssec" }]
      : base;
  }, [advanced]);
  const { sorted, sort, toggle } = useSort(zone.dnssec.keys, columns, { id: "name", desc: false });
  const selectedKey = zone.dnssec.keys.find((key) => selected.has(key.name)) ?? null;

  const apply = async (enabled: boolean, kskName = "") => {
    try {
      await api.put(`/zones/${zone.id}/dnssec`, { enabled, ksk_name: kskName });
      notify({ type: "success", header: enabled ? "DNSSEC signing enabled." : "DNSSEC signing disabled." });
      setEnabling(false);
      setDisabling(false);
      setSelected(new Set());
      setDismissed(false);
      onChanged();
    } catch (error) {
      setEnabling(false);
      setDisabling(false);
      notify({ type: "error", header: "Unable to update DNSSEC signing", content: (error as Error).message });
    }
  };

  return (
    <>
      <Container
        title="DNSSEC signing"
        info="dnssec"
        actions={
          signing ? (
            <Button onClick={() => setDisabling(true)}>Disable DNSSEC signing</Button>
          ) : (
            <Button disabled={zone.private_zone} onClick={() => setEnabling(true)}>
              Enable DNSSEC signing
            </Button>
          )
        }
      >
        <dl className="read-only single">
          <dt>DNSSEC signing status</dt>
          <dd>{signing ? <StatusIndicator kind="success">Signing</StatusIndicator> : <StatusIndicator kind="stopped">Not signing</StatusIndicator>}</dd>
        </dl>
        {!dismissed && (
          <Alert type="info" header={signing ? "DNSSEC signing is enabled for this hosted zone" : "You have not enabled DNSSEC signing for this hosted zone"} onDismiss={() => setDismissed(true)}>
            {signing
              ? "Next, you must establish a chain of trust by adding a delegation signer (DS) record to the parent zone of your domain."
              : "To enable DNSSEC signing and have Route 53 create a key-signing key (KSK) for you, choose Enable DNSSEC signing. Next, you must establish a DNSSEC chain of trust for your hosted zone. You’ll complete this step after you enable DNSSEC signing."}
          </Alert>
        )}
        {zone.private_zone && <p className="field-hint">DNSSEC signing is only available for public hosted zones.</p>}
      </Container>
      <Container
        title="Key-signing keys (KSKs)"
        info="dnssec"
        actions={
          <>
            <Button disabled={!selectedKey} onClick={() => setViewing(selectedKey)}>
              View details
            </Button>
            <Button onClick={() => setAdvanced(!advanced)}>{advanced ? "Switch to simple view" : "Switch to advanced view"}</Button>
          </>
        }
      >
        <div className="filter-row right">
          <Pagination page={page} pages={1} onChange={setPage} onSettings={() => notify({ type: "info", header: "This table has no configurable preferences." })} />
        </div>
        <DataTable
          label="Key-signing keys"
          columns={columns}
          rows={sorted}
          rowKey={(key) => key.name}
          sort={sort}
          onSort={toggle}
          selection="single"
          selected={selected}
          onSelectionChange={setSelected}
          empty="No key-signing keys created."
        />
      </Container>
      {enabling && <EnableDnssecModal zone={zone} onCancel={() => setEnabling(false)} onConfirm={(name) => apply(true, name)} />}
      {disabling && (
        <Modal
          title="Disable DNSSEC signing?"
          size="small"
          onClose={() => setDisabling(false)}
          footer={
            <>
              <Button variant="link" onClick={() => setDisabling(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => apply(false)}>
                Disable
              </Button>
            </>
          }
        >
          <p>Route 53 stops signing the records in this hosted zone and deletes its key-signing key. Remove the DS record from the parent zone first, or resolvers that validate DNSSEC will fail to resolve your domain.</p>
        </Modal>
      )}
      {viewing && (
        <Modal
          title={`Key-signing key ${viewing.name}`}
          onClose={() => setViewing(null)}
          footer={
            <Button variant="primary" onClick={() => setViewing(null)}>
              Close
            </Button>
          }
        >
          <dl className="read-only">
            <div>
              <dt>Name</dt>
              <dd>{viewing.name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{viewing.status}</dd>
            </div>
            <div>
              <dt>Creation date</dt>
              <dd>{formatDate(viewing.created_at)}</dd>
            </div>
            <div>
              <dt>Signing algorithm</dt>
              <dd>ECDSAP256SHA256 (13)</dd>
            </div>
          </dl>
        </Modal>
      )}
    </>
  );
}

function EnableDnssecModal({ zone, onCancel, onConfirm }: { zone: Zone; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState(`ksk_${zone.id.slice(-6).toLowerCase()}`);
  const valid = /^[A-Za-z0-9_-]{3,128}$/.test(name);
  return (
    <Modal
      title="Enable DNSSEC signing"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => onConfirm(name)}>
            Enable DNSSEC signing
          </Button>
        </>
      }
    >
      <Field label="Key-signing key (KSK) name" htmlFor="ksk-name" description="Route 53 creates a KSK with this name, backed by a customer managed key in AWS KMS." hint="3-128 characters: a-z, A-Z, 0-9, _ and -." error={valid ? undefined : "Enter a valid KSK name."}>
        <input id="ksk-name" className="text-input wide" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
    </Modal>
  );
}

/* -------------------------------------------------------------------- tags */

export function TagsTab({ zone, onChanged }: TabProps) {
  const { api, notify } = useConsole();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState(false);
  const rows = useMemo(() => zone.tags.filter((tag) => `${tag.key} ${tag.value}`.toLowerCase().includes(filter.trim().toLowerCase())), [zone.tags, filter]);
  const columns = useMemo<Column<Tag>[]>(
    () => [
      { id: "key", header: "Key", width: 400, sortValue: (tag) => tag.key, cell: (tag) => tag.key },
      { id: "value", header: "Value", width: 500, sortValue: (tag) => tag.value, cell: (tag) => tag.value || "-" },
    ],
    [],
  );
  const { sorted, sort, toggle } = useSort(rows, columns, { id: "key", desc: false });

  const save = async (tags: Tag[]) => {
    try {
      await api.put(`/zones/${zone.id}/tags`, { tags: tags.filter((tag) => tag.key.trim()) });
      notify({ type: "success", header: "Tags updated successfully." });
      setManaging(false);
      onChanged();
    } catch (error) {
      notify({ type: "error", header: "Unable to update tags", content: (error as Error).message });
    }
  };

  return (
    <Container
      title="Tags"
      info="tags"
      actions={<Button onClick={() => setManaging(true)}>Manage tags</Button>}
    >
      <div className="filter-row">
        <SearchInput value={filter} onChange={(value) => { setFilter(value); setPage(1); }} placeholder="Search" className="filter-wide" />
        <Pagination page={page} pages={1} onChange={setPage} />
      </div>
      <DataTable label="Tags" columns={columns} rows={sorted} rowKey={(tag) => tag.key} sort={sort} onSort={toggle} empty={filter ? "No tags match your search." : "No tags associated with the resource."} />
      {managing && <ManageTagsModal tags={zone.tags} onCancel={() => setManaging(false)} onSave={save} />}
    </Container>
  );
}

function ManageTagsModal({ tags, onCancel, onSave }: { tags: Tag[]; onCancel: () => void; onSave: (tags: Tag[]) => void }) {
  const [draft, setDraft] = useState<Tag[]>(tags);
  const duplicates = hasDuplicateTags(draft);
  return (
    <Modal
      title="Manage tags"
      size="large"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={duplicates} onClick={() => onSave(draft)}>
            Save changes
          </Button>
        </>
      }
    >
      <TagEditor tags={draft} onChange={setDraft} />
    </Modal>
  );
}
