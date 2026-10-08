"use client";

import { FormEvent, useState } from "react";
import { Frame } from "../components/Frame";
import { RefreshIcon, SearchIcon } from "../components/icons";
import { Alert, Button, Container, InfoLink, RoundIconButton } from "../components/ui";
import { useConsole } from "../lib/console";
import { useResource } from "../lib/hooks";
import { paths } from "../lib/router";
import type { Zone } from "../lib/types";

const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function DashboardView() {
  const { api, go } = useConsole();
  const zones = useResource(() => api.get<Zone[]>("/zones"), [api]);
  const [domain, setDomain] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [notificationFilter, setNotificationFilter] = useState("");
  const count = zones.data?.length ?? 0;

  const check = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    setMessage(
      DOMAIN.test(value)
        ? { type: "success", text: `“${value}” is ready for a simulated availability search. Domain registration is mocked in this local demo.` }
        : { type: "error", text: "Enter a valid domain name to check availability." },
    );
  };

  return (
    <Frame crumbs={[{ label: "Route 53", to: paths.zones() }, { label: "Dashboard" }]} activeNav="Dashboard" helpTopic="dashboard">
      <h1 className="dashboard-title">
        Route 53 Dashboard <InfoLink topic="dashboard" />
      </h1>
      <Container className="summary">
        <div className="summary-grid">
          <div>
            <h2>DNS management</h2>
            <a
              className="summary-number"
              href={`#${paths.zones()}`}
              onClick={(event) => {
                event.preventDefault();
                go(paths.zones());
              }}
            >
              {zones.loading && !zones.data ? "…" : count}
            </a>
            <p>Hosted zone{count === 1 ? "" : "s"}</p>
          </div>
          <div>
            <h2>Availability monitoring</h2>
            <p>Health checks monitor your applications and web resources, and direct DNS queries to healthy resources.</p>
            <Button onClick={() => go(paths.mock("health-checks"))}>Create health check</Button>
          </div>
          <div>
            <h2>Traffic management</h2>
            <p>A visual tool that lets you easily create policies for multiple endpoints in complex configurations.</p>
            <Button onClick={() => go(paths.mock("traffic-policies"))}>Create policy</Button>
          </div>
          <div>
            <h2>Domain registration</h2>
            <a
              className="summary-number"
              href={`#${paths.mock("registered-domains")}`}
              onClick={(event) => {
                event.preventDefault();
                go(paths.mock("registered-domains"));
              }}
            >
              0
            </a>
            <p>Domains</p>
          </div>
        </div>
      </Container>
      <Container title="Register domain">
        <p>
          Find and register an available domain, or{" "}
          <button type="button" className="inline-link" onClick={() => go(paths.mock("requests"))}>
            transfer your existing domains
          </button>{" "}
          to Route 53.
        </p>
        <form onSubmit={check}>
          <input className="text-input wide" value={domain} placeholder="Enter a domain name" aria-label="Domain name" onChange={(event) => setDomain(event.target.value)} />
          <p className="field-hint">Each label (each part between dots) can be up to 63 characters long and must start with a-z or 0-9. Maximum length: 255 characters, including dots. Valid characters: a-z, 0-9, and - (hyphen)</p>
          <Button type="submit">Check</Button>
        </form>
        {message && (
          <Alert type={message.type} className="spaced">
            {message.text}
          </Alert>
        )}
      </Container>
      <Container title="Notifications" actions={<RoundIconButton label="Refresh notifications" onClick={zones.reload}><RefreshIcon size={16} /></RoundIconButton>}>
        <div className="search-input filter-wide">
          <SearchIcon size={16} />
          <input value={notificationFilter} placeholder="Find notifications" aria-label="Find notifications" onChange={(event) => setNotificationFilter(event.target.value)} />
        </div>
        <table className="data-table notifications-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Status</th>
              <th>Last update</th>
            </tr>
          </thead>
        </table>
        <div className="table-empty">No notifications to display</div>
      </Container>
    </Frame>
  );
}
