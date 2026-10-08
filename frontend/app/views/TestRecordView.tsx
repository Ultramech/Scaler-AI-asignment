"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Frame } from "../components/Frame";
import { SearchIcon, TriangleDownIcon, TriangleRightIcon } from "../components/icons";
import { Alert, Button, Container, Field, PageHeader, StatusIndicator, useDisclosure } from "../components/ui";
import { useZone, ZoneBoundary } from "../components/ZoneBoundary";
import { useConsole } from "../lib/console";
import { displayName, RECORD_TYPES } from "../lib/dns";
import { paths } from "../lib/router";
import type { TestRecordResult, Zone } from "../lib/types";

export function TestRecordView({ zoneId }: { zoneId: string }) {
  const zone = useZone(zoneId);
  const name = zone.data ? displayName(zone.data.name) : "Hosted zone";
  return (
    <Frame
      crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Hosted zones", to: paths.zones() }, { label: name, to: paths.zone(zoneId) }, { label: "Test record" }]}
      navOpen={false}
      helpTopic="test-record"
      toolsOpen
    >
      <ZoneBoundary resource={zone}>{(loaded) => <TestRecordForm zone={loaded} />}</ZoneBoundary>
    </Frame>
  );
}

function TestRecordForm({ zone }: { zone: Zone }) {
  const { api, go } = useConsole();
  const [name, setName] = useState("");
  const [type, setType] = useState("A");
  const [resolver, setResolver] = useState("");
  const [subnet, setSubnet] = useState("");
  const [mask, setMask] = useState("");
  const [result, setResult] = useState<TestRecordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const additional = useDisclosure(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const domain = displayName(zone.name);

  useEffect(() => {
    if (result || error) resultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [result, error]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post<TestRecordResult>(`/zones/${zone.id}/test-record`, { name, type, resolver_ip: resolver }));
    } catch (failure) {
      setResult(null);
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-page wide-form" onSubmit={submit}>
      <PageHeader title="Test record" info="test-record" description="Test records to simulate the values that Route 53 returns in response to DNS queries. This tool displays the standard values that Route 53 provides based on the settings in the hosted zone. The tool doesn’t send actual DNS queries." />
      <Container title="Record to test">
        <div className="read-only single">
          <dt>Hosted zone</dt>
          <dd>{domain}</dd>
        </div>
        <Field
          label="Record name"
          optional
          info="record-name"
          htmlFor="test-name"
          description={`To check a record that has the same name as the hosted zone ${domain}, leave this field blank. To check the record for a subdomain, enter the subdomain name excluding the domain name.`}
        >
          <div className="search-input full">
            <SearchIcon size={16} />
            <input id="test-name" value={name} placeholder="www" autoComplete="off" onChange={(event) => setName(event.target.value)} />
          </div>
        </Field>
        <Field label="Record type" info="record-type" htmlFor="test-type" description="The DNS type of the record determines the format of the value that Route 53 returns in response to DNS queries.">
          <div className="select-wrap">
            <select id="test-type" className="text-input" value={type} onChange={(event) => setType(event.target.value)}>
              {[...RECORD_TYPES, { type: "SOA", label: "SOA – Start of authority" }].map((entry) => (
                <option key={entry.type} value={entry.type}>
                  {entry.label}
                </option>
              ))}
            </select>
            <TriangleDownIcon size={11} className="select-caret" />
          </div>
        </Field>
      </Container>
      <Container title={<>Settings to simulate DNS queries - <i>optional</i></>} description="Simulate the response that Route 53 returns to a specific IP address. This is useful for testing geolocation and latency records.">
        <Field
          label="Resolver IP address"
          info="test-record"
          htmlFor="test-resolver"
          description="The IP address that the tool uses to simulate the location of the DNS resolver that a client uses to make requests. If you omit this value, the tool uses the IP address of a DNS resolver in the AWS US East (N. Virginia) Region."
        >
          <input id="test-resolver" className="text-input wide" value={resolver} placeholder="192.0.2.25" onChange={(event) => setResolver(event.target.value)} />
        </Field>
        <div className="container-footer left">
          <button type="button" className="disclosure disclosure-heading" aria-expanded={additional.open} onClick={additional.toggle}>
            {additional.open ? <TriangleDownIcon size={12} /> : <TriangleRightIcon size={12} />} Additional configuration
          </button>
          {additional.open && (
            <div className="record-grid">
              <Field label="EDNS0 client subnet IP" optional htmlFor="test-subnet" description="The IP address of the client subnet to simulate.">
                <input id="test-subnet" className="text-input" value={subnet} placeholder="192.0.2.0" onChange={(event) => setSubnet(event.target.value)} />
              </Field>
              <Field label="EDNS0 client subnet mask" optional htmlFor="test-mask" description="The number of bits of the client subnet IP to use.">
                <input id="test-mask" className="text-input" inputMode="numeric" value={mask} placeholder="24" onChange={(event) => setMask(event.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </Container>

      <div ref={resultRef}>
        {error && (
          <Alert type="error" header="Unable to get a response">
            {error}
          </Alert>
        )}
        {result && (
          <Container title="Response returned by Route 53" className="test-result">
            <dl className="read-only">
              <div>
                <dt>Response code</dt>
                <dd>
                  <StatusIndicator kind={result.response_code === "NOERROR" ? "success" : "error"}>{result.response_code}</StatusIndicator>
                </dd>
              </div>
              <div>
                <dt>Protocol</dt>
                <dd>{result.protocol}</dd>
              </div>
              <div>
                <dt>Record name</dt>
                <dd>{displayName(result.record_name)}</dd>
              </div>
              <div>
                <dt>Record type</dt>
                <dd>{result.record_type}</dd>
              </div>
              <div>
                <dt>TTL (seconds)</dt>
                <dd>{result.ttl ?? "-"}</dd>
              </div>
              <div>
                <dt>Value/Route traffic to</dt>
                <dd>{result.values.length ? result.values.map((value) => <div key={value}>{value}</div>) : result.response_code === "NXDOMAIN" ? "The record doesn’t exist in this hosted zone." : "No records of this type."}</dd>
              </div>
            </dl>
          </Container>
        )}
      </div>

      <div className="inline-actions">
        <Button variant="link" onClick={() => go(paths.zone(zone.id))}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={busy}>
          Get response
        </Button>
      </div>
    </form>
  );
}
