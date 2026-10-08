"use client";

import { FormEvent, useEffect, useState } from "react";
import { Frame } from "../components/Frame";
import { draftFromRecord, draftToInput, RecordDraft, RecordFields, validateDraft } from "../components/RecordForm";
import { Alert, Button, Container, Loading, PageHeader } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { useResource } from "../lib/hooks";
import { paths } from "../lib/router";
import type { DnsRecord, Zone } from "../lib/types";

export function EditRecordView({ zoneId, recordId }: { zoneId: string; recordId: number }) {
  const zone = useZone(zoneId);
  const name = zone.data ? displayName(zone.data.name) : "Hosted zone";
  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name, to: paths.zone(zoneId) }, { label: "Edit record" }]}
      navOpen={false}
      helpTopic="create-record"
    >
      <ZoneBoundary resource={zone}>{(loaded) => <EditRecordLoader zone={loaded} recordId={recordId} />}</ZoneBoundary>
    </Frame>
  );
}

function EditRecordLoader({ zone, recordId }: { zone: Zone; recordId: number }) {
  const { api, go } = useConsole();
  const record = useResource(() => api.get<DnsRecord>(`/records/${recordId}`), [recordId, api]);
  if (record.data && record.data.zone_id === zone.id) return <EditRecordForm zone={zone} record={record.data} />;
  if (record.error || record.data) {
    return (
      <Alert type="error" header="Unable to load the record" action={<Button onClick={() => go(paths.zone(zone.id))}>Back to hosted zone</Button>}>
        {record.error ?? "This record does not belong to the hosted zone."}
      </Alert>
    );
  }
  return <Loading>Loading record</Loading>;
}

function EditRecordForm({ zone, record }: { zone: Zone; record: DnsRecord }) {
  const { api, go, notify } = useConsole();
  const [draft, setDraft] = useState<RecordDraft>(() => draftFromRecord(record, zone));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(draftFromRecord(record, zone)), [record, zone]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateDraft(draft);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await api.put(`/records/${record.id}`, draftToInput(draft));
      notify({ type: "success", header: "Record updated successfully." }, 1);
      go(paths.zone(zone.id, "records", record.id));
    } catch (failure) {
      setError((failure as Error).message);
      notify({ type: "error", header: "Unable to save the record", content: (failure as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-page" onSubmit={save}>
      <PageHeader title="Edit record" info="create-record" />
      <Container title="Edit record" description={record.protected ? `This is a required record. You can change its value and TTL, but not its name or type.` : undefined}>
        <RecordFields draft={draft} zone={zone} onChange={setDraft} lockIdentity={record.protected} error={error} idPrefix="edit-record" />
      </Container>
      <div className="inline-actions">
        <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
