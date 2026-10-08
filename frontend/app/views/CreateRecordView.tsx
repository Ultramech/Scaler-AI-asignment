"use client";

import { FormEvent, useRef, useState } from "react";
import { Frame } from "../components/Frame";
import { TriangleDownIcon, TriangleRightIcon } from "../components/icons";
import { draftToInput, newDraft, RecordBlock, RecordDraft, RecordFields, validateDraft } from "../components/RecordForm";
import { Button, Container, PageHeader, useDisclosure } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { ApiError } from "../lib/api";
import { useConsole } from "../lib/console";
import { displayName, ROUTING_POLICIES } from "../lib/dns";
import { paths } from "../lib/router";
import type { Zone } from "../lib/types";

const POLICY_DESCRIPTIONS: Record<string, string> = {
  Simple: "Route traffic to a single resource, such as a web server, using the standard DNS record.",
  Weighted: "Route traffic to multiple resources in proportions that you specify.",
  Latency: "Route traffic to the resource that provides the best latency.",
  Failover: "Route traffic to a resource when the resource is healthy, or to a different resource when the first is unhealthy.",
  Geolocation: "Route traffic based on the location of your users.",
  Geoproximity: "Route traffic based on the geographic location of your users and your resources.",
  "Multivalue answer": "Route traffic approximately randomly to multiple resources, using values that Route 53 checks for health.",
  "IP-based": "Route traffic based on the IP address that the DNS query comes from.",
};

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
  const [mode, setMode] = useState<"quick" | "wizard">("quick");
  const [step, setStep] = useState<1 | 2>(1);
  const [policy, setPolicy] = useState("Simple");
  const [drafts, setDrafts] = useState<RecordDraft[]>([newDraft(0)]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const method = useDisclosure(true);

  const update = (draft: RecordDraft) => setDrafts((current) => current.map((entry) => (entry.key === draft.key ? draft : entry)));
  const switchMode = (next: "quick" | "wizard") => {
    setMode(next);
    setStep(1);
    setErrors({});
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const found: Record<number, string> = {};
    drafts.forEach((draft) => {
      const problem = validateDraft(draft);
      if (problem) found[draft.key] = problem;
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const result = await api.post<{ created: number }>(`/zones/${zone.id}/records/batch`, { records: drafts.map(draftToInput) });
      notify({ type: "success", header: result.created === 1 ? "Record created successfully." : `${result.created} records created successfully.` }, 1);
      go(paths.zone(zone.id));
    } catch (error) {
      const failure = error as ApiError;
      const target = failure.index !== undefined ? drafts[failure.index] : drafts[0];
      if (drafts.length > 1 || mode === "quick") setErrors({ [target.key]: failure.message });
      notify({ type: "error", header: "Unable to create the record", content: failure.message });
    } finally {
      setBusy(false);
    }
  };

  const choosingPolicy = mode === "wizard" && step === 1;
  const title = mode === "wizard" ? (step === 1 ? "Choose routing policy" : "Configure records") : "Quick create record";

  const actionBar = (
    <>
      <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
        Cancel
      </Button>
      {mode === "wizard" && step === 2 && <Button onClick={() => setStep(1)}>Previous</Button>}
      {choosingPolicy ? (
        <Button
          variant="primary"
          onClick={() => {
            setDrafts((current) => current.map((draft) => ({ ...draft, policy })));
            setStep(2);
          }}
        >
          Next
        </Button>
      ) : (
        <Button variant="primary" disabled={busy} onClick={() => submit()}>
          Create records
        </Button>
      )}
    </>
  );

  return (
    <div className="form-page">
      <Container className="method-card">
        <button type="button" className="disclosure disclosure-heading" aria-expanded={method.open} onClick={method.toggle}>
          {method.open ? <TriangleDownIcon size={13} /> : <TriangleRightIcon size={13} />} Record creation method
        </button>
        {method.open && (
          <div className="method-grid">
            <div>
              <strong>Quick create (recommended for expert users)</strong>
              <p>Choose this method if you are confident in the process of creating records and know which options you need.</p>
            </div>
            <div>
              <strong>Wizard (recommended for new users)</strong>
              <p>Choose this method if you need more explanations as you create your record.</p>
            </div>
          </div>
        )}
      </Container>

      <PageHeader title="Create record" info="create-record" />
      <form onSubmit={submit}>
        <Container
          title={title}
          actions={
            <button type="button" className="inline-link strong" onClick={() => switchMode(mode === "quick" ? "wizard" : "quick")}>
              {mode === "quick" ? "Switch to wizard" : "Switch to quick create"}
            </button>
          }
        >
          {choosingPolicy ? (
            <div className="policy-grid" role="radiogroup" aria-label="Routing policy">
              {ROUTING_POLICIES.map((option) => (
                <label key={option.value} className={`tile ${policy === option.value ? "selected" : ""}`}>
                  <input type="radio" name="policy" checked={policy === option.value} onChange={() => setPolicy(option.value)} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{POLICY_DESCRIPTIONS[option.value]}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <>
              {drafts.map((draft, index) => (
                <RecordBlock key={draft.key} title={`Record ${index + 1}`} deleteDisabled={drafts.length === 1} onDelete={() => setDrafts((current) => current.filter((entry) => entry.key !== draft.key))}>
                  <RecordFields draft={draft} zone={zone} onChange={update} error={errors[draft.key]} lockPolicy={mode === "wizard"} autoFocus={index === 0} idPrefix={`record-${draft.key}`} />
                </RecordBlock>
              ))}
              <div className="container-footer">
                <Button
                  onClick={() => {
                    const key = counter.current++;
                    setDrafts((current) => [...current, newDraft(key, mode === "wizard" ? policy : "Simple")]);
                  }}
                  disabled={drafts.length >= 100}
                >
                  Add another record
                </Button>
              </div>
            </>
          )}
        </Container>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <div className="inline-actions">{actionBar}</div>
    </div>
  );
}
