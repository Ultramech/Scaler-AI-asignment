"use client";

import { FormEvent, useState } from "react";
import { Frame } from "../components/Frame";
import { hasDuplicateTags, TagEditor } from "../components/TagEditor";
import { Button, Container, Field, InfoLink, PageHeader } from "../components/ui";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { paths } from "../lib/router";
import type { Tag, Zone } from "../lib/types";

const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1"];
const LABEL = /^[a-z0-9!"#$%&'()*+,/:;<=>?@[\\\]^_`{|}~-]{1,63}$/i;

/** Mirrors the server's domain rules so mistakes show up before the request is sent. */
export function validateDomain(raw: string, privateZone: boolean): string | null {
  const name = raw.trim().replace(/\.$/, "");
  if (!name) return "Domain name is required.";
  if (name.length > 253) return "Domain name can be at most 253 characters long.";
  const labels = name.split(".");
  if (labels.some((label) => !LABEL.test(label) || label.startsWith("-") || label.endsWith("-"))) {
    return "Enter a valid domain name. Labels are 1-63 characters and cannot start or end with a hyphen.";
  }
  if (labels.length < 2 && !privateZone) return "Enter a fully qualified domain name such as example.com.";
  return null;
}

export function CreateZoneView() {
  const { api, go, notify } = useConsole();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [privateZone, setPrivateZone] = useState(false);
  const [region, setRegion] = useState(REGIONS[0]);
  const [vpcId, setVpcId] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [errors, setErrors] = useState<{ name?: string; vpc?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nameError = validateDomain(name, privateZone);
    const vpcError = privateZone && !vpcId.trim() ? "Enter the ID of a VPC to associate with the hosted zone." : undefined;
    setErrors({ name: nameError ?? undefined, vpc: vpcError });
    if (nameError || vpcError) return;
    if (hasDuplicateTags(tags)) return notify({ type: "error", header: "Tag keys must be unique." });
    setBusy(true);
    try {
      const zone = await api.post<Zone>("/zones", {
        name,
        comment,
        private_zone: privateZone,
        vpc_region: privateZone ? region : "",
        vpc_id: privateZone ? vpcId : "",
        tags: tags.filter((tag) => tag.key.trim()),
      });
      notify({ type: "success", header: `Successfully created hosted zone ${displayName(zone.name)}.` }, 1);
      go(paths.zone(zone.id));
    } catch (error) {
      const message = (error as Error).message;
      if (/already exists/.test(message)) setErrors({ name: message });
      else notify({ type: "error", header: "Unable to create the hosted zone", content: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: "Create hosted zone" }]}
      navOpen={false}
      helpTopic="create-hosted-zone"
      actionBar={
        <>
          <Button variant="link" onClick={() => go(paths.zones())}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="create-zone" disabled={busy}>
            Create hosted zone
          </Button>
        </>
      }
    >
      <form id="create-zone" className="form-page" onSubmit={submit} noValidate>
        <PageHeader title="Create hosted zone" info="create-hosted-zone" />
        <Container title="Hosted zone configuration" description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains.">
          <Field
            label="Domain name"
            info="domain-name"
            htmlFor="zone-name"
            description="This is the name of the domain that you want to route traffic for."
            hint={<>Valid characters: a-z, 0-9, ! &quot; # $ % &amp; &apos; ( ) * + , - / : ; &lt; = &gt; ? @ [ \ ] ^ _ ` {"{"} | {"}"} . ~</>}
            error={errors.name}
          >
            <input id="zone-name" className={`text-input wide ${errors.name ? "invalid" : ""}`} value={name} placeholder="example.com" autoFocus autoComplete="off" onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description" optional info="description" htmlFor="zone-comment" description="This value lets you distinguish hosted zones that have the same name." hint={`The description can have up to 256 characters. ${comment.length}/256`}>
            <textarea id="zone-comment" className="text-input wide" rows={3} maxLength={256} value={comment} placeholder="The hosted zone is used for..." onChange={(event) => setComment(event.target.value)} />
          </Field>
          <fieldset className="field">
            <legend className="field-label">
              Type <InfoLink topic="hosted-zone-type" />
            </legend>
            <div className="field-description">The type indicates whether you want to route traffic on the internet or in an Amazon VPC.</div>
            <div className="tile-row">
              <label className={`tile ${!privateZone ? "selected" : ""}`}>
                <input type="radio" name="zone-type" checked={!privateZone} onChange={() => setPrivateZone(false)} />
                <span>
                  <strong>Public hosted zone</strong>
                  <small>A public hosted zone determines how traffic is routed on the internet.</small>
                </span>
              </label>
              <label className={`tile ${privateZone ? "selected" : ""}`}>
                <input type="radio" name="zone-type" checked={privateZone} onChange={() => setPrivateZone(true)} />
                <span>
                  <strong>Private hosted zone</strong>
                  <small>A private hosted zone determines how traffic is routed within an Amazon VPC.</small>
                </span>
              </label>
            </div>
          </fieldset>
          {privateZone && (
            <div className="vpc-fields">
              <Field label="Region" htmlFor="vpc-region">
                <select id="vpc-region" className="text-input" value={region} onChange={(event) => setRegion(event.target.value)}>
                  {REGIONS.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </Field>
              <Field label="VPC ID" htmlFor="vpc-id" description="A private hosted zone must be associated with at least one VPC." error={errors.vpc}>
                <input id="vpc-id" className={`text-input ${errors.vpc ? "invalid" : ""}`} value={vpcId} placeholder="vpc-0123456789abcdef0" onChange={(event) => setVpcId(event.target.value)} />
              </Field>
            </div>
          )}
        </Container>
        <Container title="Tags" info="tags" description="Apply tags to hosted zones to help organize and identify them.">
          <TagEditor tags={tags} onChange={setTags} />
        </Container>
      </form>
    </Frame>
  );
}
