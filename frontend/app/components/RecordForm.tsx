"use client";

import { ReactNode } from "react";
import { ALIAS_ENDPOINTS, ALIAS_TYPES, displayName, RECORD_TYPES, relativeName, ROUTING_POLICIES, TTL_PRESETS } from "../lib/dns";
import type { DnsRecord, RecordInput, Zone } from "../lib/types";
import { TriangleDownIcon, TriangleRightIcon } from "./icons";
import { Button, Field, Toggle, useDisclosure } from "./ui";

export type RecordDraft = {
  key: number;
  name: string;
  type: string;
  value: string;
  ttl: string;
  policy: string;
  alias: boolean;
  endpoint: number;
  evaluate: boolean;
  setId: string;
};

export const newDraft = (key: number, policy = "Simple"): RecordDraft => ({
  key,
  name: "",
  type: "A",
  value: "",
  ttl: "300",
  policy,
  alias: false,
  endpoint: 0,
  evaluate: false,
  setId: "",
});

export const draftFromRecord = (record: DnsRecord, zone: Zone): RecordDraft => ({
  key: record.id,
  name: relativeName(record.name, zone.name),
  type: record.type,
  value: record.value,
  ttl: String(record.alias ? 300 : record.ttl),
  policy: record.routing_policy,
  alias: record.alias,
  endpoint: 0,
  evaluate: record.evaluate_target_health,
  setId: record.set_identifier,
});

export const draftToInput = (draft: RecordDraft): RecordInput => ({
  name: draft.name.trim(),
  type: draft.type,
  value: draft.value,
  ttl: Number(draft.ttl),
  routing_policy: draft.policy,
  alias: draft.alias,
  evaluate_target_health: draft.alias && draft.evaluate,
  set_identifier: draft.setId.trim(),
});

/** Client-side checks that don't need the zone; the API validates values per record type. */
export function validateDraft(draft: RecordDraft): string | null {
  if (!draft.value.trim()) return draft.alias ? "Enter the alias target." : "Enter a value for the record.";
  if (!draft.alias && (!/^\d+$/.test(draft.ttl) || Number(draft.ttl) > 2147483647)) return "TTL must be a whole number of seconds between 0 and 2147483647.";
  if (draft.policy !== "Simple" && !draft.setId.trim()) return `Record ID is required for the ${draft.policy} routing policy.`;
  return null;
}

type FieldsProps = {
  draft: RecordDraft;
  zone: Zone;
  onChange: (draft: RecordDraft) => void;
  /** Protected records keep their name and type. */
  lockIdentity?: boolean;
  /** Wizard mode fixes the routing policy chosen on the first step. */
  lockPolicy?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  idPrefix: string;
};

export function RecordFields({ draft, zone, onChange, lockIdentity, lockPolicy, error, autoFocus, idPrefix }: FieldsProps) {
  const patch = (changes: Partial<RecordDraft>) => onChange({ ...draft, ...changes });
  const typeInfo = RECORD_TYPES.find((entry) => entry.type === draft.type);
  const endpoint = ALIAS_ENDPOINTS[draft.endpoint];
  const aliasAllowed = ALIAS_TYPES.includes(draft.type) && !lockIdentity;
  const options: { type: string; label: string }[] = [...RECORD_TYPES];
  if (draft.type === "SOA") options.push({ type: "SOA", label: "SOA – Start of authority" });

  return (
    <div className="record-fields">
      {error && (
        <div className="field-error record-error" role="alert">
          {error}
        </div>
      )}
      <div className="record-grid">
        <Field label="Record name" info="record-name" htmlFor={`${idPrefix}-name`} hint="Keep blank to create a record for the root domain.">
          <div className="name-input">
            <input id={`${idPrefix}-name`} className="text-input" value={draft.name} disabled={lockIdentity} placeholder="subdomain" autoComplete="off" autoFocus={autoFocus} onChange={(event) => patch({ name: event.target.value })} />
            <span>{displayName(zone.name)}</span>
          </div>
        </Field>
        <Field label="Record type" info="record-type" htmlFor={`${idPrefix}-type`}>
          <div className="select-wrap">
            <select
              id={`${idPrefix}-type`}
              className="text-input"
              value={draft.type}
              disabled={lockIdentity}
              onChange={(event) => patch({ type: event.target.value, alias: ALIAS_TYPES.includes(event.target.value) ? draft.alias : false })}
            >
              {options.map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
            <TriangleDownIcon size={11} className="select-caret" />
          </div>
        </Field>
      </div>

      <div className="alias-row">
        <Toggle checked={draft.alias} disabled={!aliasAllowed} onChange={(alias) => patch({ alias, value: alias === draft.alias ? draft.value : "" })}>
          Alias
        </Toggle>
      </div>

      {draft.alias ? (
        <>
          <Field label="Route traffic to" info="alias" htmlFor={`${idPrefix}-endpoint`}>
            <div className="select-wrap">
              <select id={`${idPrefix}-endpoint`} className="text-input" value={draft.endpoint} onChange={(event) => patch({ endpoint: Number(event.target.value) })}>
                {ALIAS_ENDPOINTS.map((entry, index) => (
                  <option key={entry.label} value={index}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <TriangleDownIcon size={11} className="select-caret" />
            </div>
          </Field>
          <Field label="Alias target" htmlFor={`${idPrefix}-value`} hint="Enter the DNS name of the resource that this record points to.">
            <input id={`${idPrefix}-value`} className="text-input wide" value={draft.value} placeholder={endpoint.placeholder} autoComplete="off" onChange={(event) => patch({ value: event.target.value })} />
          </Field>
          <Toggle checked={draft.evaluate} onChange={(evaluate) => patch({ evaluate })}>
            Evaluate target health
          </Toggle>
        </>
      ) : (
        <Field label="Value" info="value" htmlFor={`${idPrefix}-value`} hint={typeInfo?.hint ?? "Enter multiple values on separate lines."}>
          <textarea id={`${idPrefix}-value`} className="text-input wide" rows={4} value={draft.value} placeholder={typeInfo?.placeholder} spellCheck={false} onChange={(event) => patch({ value: event.target.value })} />
        </Field>
      )}

      <div className="record-grid">
        <Field label="TTL (seconds)" info="ttl" htmlFor={`${idPrefix}-ttl`} hint="Recommended values: 60 to 172800 (two days)">
          <div className="ttl-row">
            <input id={`${idPrefix}-ttl`} className="text-input" inputMode="numeric" value={draft.alias ? "" : draft.ttl} disabled={draft.alias} placeholder={draft.alias ? "Alias records have no TTL" : undefined} onChange={(event) => patch({ ttl: event.target.value })} />
            {TTL_PRESETS.map((preset) => (
              <Button key={preset.label} disabled={draft.alias} onClick={() => patch({ ttl: String(preset.seconds) })}>
                {preset.label}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Routing policy" info="routing-policy" htmlFor={`${idPrefix}-policy`}>
          <div className="select-wrap">
            <select id={`${idPrefix}-policy`} className="text-input" value={draft.policy} disabled={lockPolicy} onChange={(event) => patch({ policy: event.target.value })}>
              {ROUTING_POLICIES.map((policy) => (
                <option key={policy.value} value={policy.value}>
                  {policy.label}
                </option>
              ))}
            </select>
            <TriangleDownIcon size={11} className="select-caret" />
          </div>
        </Field>
      </div>

      {draft.policy !== "Simple" && (
        <Field label="Record ID" htmlFor={`${idPrefix}-setid`} description="Identifies this record among records that have the same name and type." hint="Enter a unique identifier, up to 128 characters.">
          <input id={`${idPrefix}-setid`} className="text-input" maxLength={128} value={draft.setId} placeholder="Enter a unique name for this record" onChange={(event) => patch({ setId: event.target.value })} />
        </Field>
      )}
    </div>
  );
}

/** A collapsible "Record N" block with an optional Delete button, as on the quick-create page. */
export function RecordBlock({ title, onDelete, deleteDisabled, children }: { title: string; onDelete?: () => void; deleteDisabled?: boolean; children: ReactNode }) {
  const { open, toggle } = useDisclosure(true);
  return (
    <div className="record-block">
      <div className="record-block-header">
        <button type="button" className="disclosure" aria-expanded={open} onClick={toggle}>
          {open ? <TriangleDownIcon size={11} /> : <TriangleRightIcon size={11} />} {title}
        </button>
        {onDelete && (
          <Button disabled={deleteDisabled} onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
      {open && children}
    </div>
  );
}
