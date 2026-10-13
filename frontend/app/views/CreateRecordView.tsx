"use client";

import { FormEvent, useRef, useState } from "react";
import { Frame } from "../components/layout/Frame";
import { draftToInput, newDraft, RecordBlock, RecordDraft, RecordFields, validateDraft } from "../components/records/RecordForm";
import { Button, Container, PageHeader } from "../components/common/ui";
import { useZone, ZoneBoundary } from "../components/zones/ZoneBoundary";
import { ApiError } from "../lib/api";
import { useConsole } from "../lib/console";
import { useBusy } from "../lib/hooks";
import { displayName } from "../lib/dns";
import { paths } from "../lib/router";
import type { Zone } from "../lib/types";

export function CreateRecordView({ zoneId }: { zoneId: string }) {
  const zone = useZone(zoneId);
  const name = zone.data ? displayName(zone.data.name) : "Hosted zone";
  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name, to: paths.zone(zoneId) }, { label: "Create record" }]}
      navOpen={false}
      helpTopic="create-record"
    >
      <ZoneBoundary resource={zone}>{(loaded) => <CreateRecordForm zone={loaded} />}</ZoneBoundary>
    </Frame>
  );
}

function CreateRecordForm({ zone }: { zone: Zone }) {
  const { api, go, notify } = useConsole();
  const counter = useRef(1);
  const [drafts, setDrafts] = useState<RecordDraft[]>([newDraft(0)]);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const update = (draft: RecordDraft) => setDrafts((current) => current.map((entry) => (entry.key === draft.key ? draft : entry)));

  const [busy, submit] = useBusy(async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<number, string> = {};
    drafts.forEach((draft) => {
      const problem = validateDraft(draft);
      if (problem) found[draft.key] = problem;
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      const result = await api.post<{ created: number }>(`/zones/${zone.id}/records/batch`, { records: drafts.map(draftToInput) });
      notify({ type: "success", header: result.created === 1 ? "Record created successfully." : `${result.created} records created successfully.` }, 1);
      go(paths.zone(zone.id));
    } catch (error) {
      const failure = error as ApiError;
      const target = failure.index !== undefined ? drafts[failure.index] : drafts[0];
      setErrors({ [target.key]: failure.message });
      notify({ type: "error", header: "Unable to create the record", content: failure.message });
    }
  });

  return (
    <form className="form-page" onSubmit={submit}>
      <PageHeader title="Create record" info="create-record" />
      <Container title="Quick create record">
        {drafts.map((draft, index) => (
          <RecordBlock key={draft.key} title={`Record ${index + 1}`} deleteDisabled={drafts.length === 1} onDelete={() => setDrafts((current) => current.filter((entry) => entry.key !== draft.key))}>
            <RecordFields draft={draft} zone={zone} onChange={update} error={errors[draft.key]} autoFocus={index === 0} idPrefix={`record-${draft.key}`} />
          </RecordBlock>
        ))}
        <div className="container-footer">
          <Button
            onClick={() => {
              const key = counter.current++;
              setDrafts((current) => [...current, newDraft(key)]);
            }}
            disabled={drafts.length >= 100}
          >
            Add another record
          </Button>
        </div>
      </Container>
      <div className="inline-actions">
        <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          Create records
        </Button>
      </div>
    </form>
  );
}
