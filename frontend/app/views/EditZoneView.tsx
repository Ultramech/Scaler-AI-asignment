"use client";

import { FormEvent, useEffect, useState } from "react";
import { Frame } from "../components/Frame";
import { hasDuplicateTags, TagEditor } from "../components/TagEditor";
import { Button, Container, Field, PageHeader } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { paths } from "../lib/router";
import type { Tag, Zone } from "../lib/types";

export function EditZoneView({ zoneId }: { zoneId: string }) {
  const zone = useZone(zoneId);
  const name = zone.data ? displayName(zone.data.name) : "Hosted zone";
  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name, to: paths.zone(zoneId) }, { label: "Edit" }]}
      navOpen={false}
      helpTopic="hosted-zone-details"
    >
      <ZoneBoundary resource={zone}>{(loaded) => <EditZoneForm zone={loaded} />}</ZoneBoundary>
    </Frame>
  );
}

function EditZoneForm({ zone }: { zone: Zone }) {
  const { api, go, notify } = useConsole();
  const [comment, setComment] = useState(zone.comment);
  const [tags, setTags] = useState<Tag[]>(zone.tags);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setComment(zone.comment);
    setTags(zone.tags);
  }, [zone]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (hasDuplicateTags(tags)) return notify({ type: "error", header: "Tag keys must be unique." });
    setBusy(true);
    try {
      await api.put(`/zones/${zone.id}`, { comment, tags: tags.filter((tag) => tag.key.trim()) });
      notify({ type: "success", header: `Successfully updated hosted zone ${displayName(zone.name)}.` }, 1);
      go(paths.zone(zone.id));
    } catch (error) {
      notify({ type: "error", header: "Unable to save the hosted zone", content: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-page" onSubmit={save}>
      <PageHeader title={`Edit ${displayName(zone.name)}`} info="hosted-zone-details" />
      <Container title="Edit hosted zone" description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains.">
        <dl className="read-only">
          <div>
            <dt>Domain name</dt>
            <dd>{displayName(zone.name)}</dd>
          </div>
          <div>
            <dt>Hosted zone ID</dt>
            <dd>{zone.id}</dd>
          </div>
          <div>
            <dt>Record count</dt>
            <dd>{zone.record_count}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{zone.private_zone ? "Private hosted zone" : "Public hosted zone"}</dd>
          </div>
        </dl>
        <Field label="Description" optional info="description" htmlFor="edit-comment" description="This value lets you distinguish hosted zones that have the same name." hint={`The description can have up to 256 characters. ${comment.length}/256`}>
          <textarea id="edit-comment" className="text-input wide" rows={3} maxLength={256} value={comment} placeholder="The hosted zone is used for..." onChange={(event) => setComment(event.target.value)} />
        </Field>
      </Container>
      <Container title="Tags" info="tags" description="Apply tags to hosted zones to help organize and identify them.">
        <TagEditor tags={tags} onChange={setTags} />
      </Container>
      <div className="inline-actions">
        <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
