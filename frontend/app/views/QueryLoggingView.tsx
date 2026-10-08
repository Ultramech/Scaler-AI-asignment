"use client";

import { FormEvent, useEffect, useState } from "react";
import { Frame } from "../components/Frame";
import { RefreshIcon, TriangleDownIcon, TriangleRightIcon } from "../components/icons";
import { Alert, Button, Container, Field, PageHeader, RoundIconButton, useDisclosure } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { useConsole } from "../lib/console";
import { displayName } from "../lib/dns";
import { useResource } from "../lib/hooks";
import { paths } from "../lib/router";
import type { Zone } from "../lib/types";

const PERMISSION_KEY = "r53-query-log-permission";
const VALID_LOG_GROUP = /^[A-Za-z0-9._/#-]{1,512}$/;

const resourcePolicy = (arn: string) =>
  JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "Route53LogsToCloudWatchLogs",
          Effect: "Allow",
          Principal: { Service: ["route53.amazonaws.com"] },
          Action: "logs:PutLogEvents",
          Resource: arn,
        },
      ],
    },
    null,
    2,
  );

export function QueryLoggingView({ zoneId }: { zoneId: string }) {
  const zone = useZone(zoneId);
  const name = zone.data ? displayName(zone.data.name) : "Hosted zone";
  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name, to: paths.zone(zoneId) }, { label: "Configure query logging" }]}
      navOpen={false}
      helpTopic="query-logging"
    >
      <ZoneBoundary resource={zone}>{(loaded) => <QueryLoggingForm zone={loaded} />}</ZoneBoundary>
    </Frame>
  );
}

function QueryLoggingForm({ zone }: { zone: Zone }) {
  const { api, go, notify } = useConsole();
  const suggested = `/aws/route53/${displayName(zone.name)}`;
  const [logGroup, setLogGroup] = useState(zone.query_log_group);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  const details = useDisclosure(false);
  const permissions = useDisclosure(false);
  const zones = useResource(() => api.get<Zone[]>("/zones"), [api]);

  useEffect(() => {
    try {
      setGranted(localStorage.getItem(PERMISSION_KEY) === "granted");
    } catch {
      /* ignore */
    }
  }, []);

  const groups = [...new Set([suggested, ...(zones.data ?? []).map((entry) => entry.query_log_group).filter(Boolean)])];
  const arn = `arn:aws:logs:us-east-1:123456789012:log-group:${logGroup || suggested}:*`;

  const grant = () => {
    setGranted(true);
    try {
      localStorage.setItem(PERMISSION_KEY, "granted");
    } catch {
      /* ignore */
    }
    notify({ type: "success", header: "Permissions granted. Route 53 can now publish logs to CloudWatch Logs." });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!logGroup.trim()) return setError("Choose or enter a log group.");
    if (!VALID_LOG_GROUP.test(logGroup.trim())) return setError("The log group can have up to 512 characters. Valid characters: a-z, A-Z, 0-9, and . _ / # - (hyphen).");
    if (!granted) return setError("Route 53 needs permission from a resource policy to publish logs to a CloudWatch Logs log group. Choose Grant permissions first.");
    setError(null);
    setBusy(true);
    try {
      await api.put(`/zones/${zone.id}/query-logging`, { log_group: logGroup.trim() });
      notify({ type: "success", header: `Successfully configured query logging for ${displayName(zone.name)}.` }, 1);
      go(paths.zone(zone.id));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/zones/${zone.id}/query-logging`);
      notify({ type: "success", header: "Query logging configuration deleted." }, 1);
      go(paths.zone(zone.id));
    } catch (failure) {
      notify({ type: "error", header: "Unable to delete the configuration", content: (failure as Error).message });
    }
  };

  return (
    <form className="form-page" onSubmit={submit} noValidate>
      <PageHeader
        title="Configure query logging"
        info="query-logging"
        description="You can configure Amazon Route 53 to log information about the queries that Route 53 receives, such as the domain or subdomain that was requested, the date and time of the query, and the DNS record type (such as A or AAAA)."
      />
      {zone.private_zone && (
        <Alert type="warning" header="Query logging isn’t available for private hosted zones">
          Use Resolver query logging to log queries from VPCs.
        </Alert>
      )}
      <Container title="Log group" info="query-logging" description="Specify the CloudWatch Logs log group where you want Route 53 to save DNS queries for records in this hosted zone.">
        <Field label="Log group" htmlFor="log-group" description="You can choose the name of an existing log group or choose to create a new log group." hint="The log group can have up to 512 characters. Valid characters: a-z, A-Z, 0-9, and . _ / # - (hyphen)" error={error}>
          <div className="log-group-row">
            <div className="select-wrap grow">
              <input id="log-group" className={`text-input ${error ? "invalid" : ""}`} list="log-groups" value={logGroup} placeholder={suggested} autoComplete="off" onChange={(event) => setLogGroup(event.target.value)} />
              <TriangleDownIcon size={11} className="select-caret" />
              <datalist id="log-groups">
                {groups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </div>
            <RoundIconButton label="Refresh log groups" onClick={zones.reload}>
              <RefreshIcon size={16} />
            </RoundIconButton>
          </div>
        </Field>
      </Container>
      {!granted && (
        <Alert
          type="warning"
          header="Missing permission"
          action={
            <Button onClick={grant} disabled={zone.private_zone}>
              Grant permissions
            </Button>
          }
        >
          Route 53 needs permission from a resource policy to publish logs to a CloudWatch Logs log group. No existing resource policies grant the required permissions.
          <button type="button" className="disclosure inline-disclosure" aria-expanded={details.open} onClick={details.toggle}>
            {details.open ? <TriangleDownIcon size={11} /> : <TriangleRightIcon size={11} />} Details
          </button>
          {details.open && <pre className="code-block">{resourcePolicy(arn)}</pre>}
        </Alert>
      )}
      <button type="button" className="disclosure disclosure-heading" aria-expanded={permissions.open} onClick={permissions.toggle}>
        {permissions.open ? <TriangleDownIcon size={13} /> : <TriangleRightIcon size={13} />} Permissions - <i>optional</i>
      </button>
      {permissions.open && (
        <Container>
          <p>
            {granted
              ? "A resource policy that lets Route 53 write to CloudWatch Logs exists in this account."
              : "Route 53 uses a CloudWatch Logs resource policy to publish query logs. Choose Grant permissions to create it automatically."}
          </p>
          <pre className="code-block">{resourcePolicy(arn)}</pre>
        </Container>
      )}
      <div className="inline-actions">
        {zone.query_log_group && (
          <Button className="push-left" onClick={remove}>
            Delete configuration
          </Button>
        )}
        <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy || zone.private_zone}>
          {zone.query_log_group ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}
