"use client";

import { useCallback, useEffect, useState } from "react";
import { Login, Session } from "./components/Login";
import { ConsoleProvider } from "./lib/console";
import { Route, useRoute } from "./lib/router";
import { CreateRecordView } from "./views/CreateRecordView";
import { CreateZoneView } from "./views/CreateZoneView";
import { DashboardView } from "./views/DashboardView";
import { EditRecordView } from "./views/EditRecordView";
import { EditZoneView } from "./views/EditZoneView";
import { ImportView } from "./views/ImportView";
import { MockView } from "./views/MockView";
import { QueryLoggingView } from "./views/QueryLoggingView";
import { TestRecordView } from "./views/TestRecordView";
import { ZoneDetailView } from "./views/ZoneDetailView";
import { ZonesView } from "./views/ZonesView";

const SESSION_KEY = "r53-session";

function loadSession(): Session | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    return null;
  }
}

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
  }, []);

  const signIn = (next: Session) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      /* the session then lasts until the tab closes */
    }
    setSession(next);
  };

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  if (!ready) return null;
  if (!session) return <Login onSignedIn={signIn} />;
  return (
    <ConsoleProvider token={session.token} user={session.user} onLogout={signOut}>
      <Routes />
    </ConsoleProvider>
  );
}

function Routes() {
  const route = useRoute();
  return renderRoute(route);
}

function renderRoute(route: Route) {
  switch (route.name) {
    case "zones":
      return <ZonesView />;
    case "zone-create":
      return <CreateZoneView />;
    case "zone":
      return <ZoneDetailView key={route.id} zoneId={route.id} tab={route.tab} record={route.record} />;
    case "zone-edit":
      return <EditZoneView zoneId={route.id} />;
    case "record-create":
      return <CreateRecordView zoneId={route.id} />;
    case "record-edit":
      return <EditRecordView zoneId={route.id} recordId={route.recordId} />;
    case "import":
      return <ImportView zoneId={route.id} />;
    case "query-logging":
      return <QueryLoggingView zoneId={route.id} />;
    case "test-record":
      return <TestRecordView zoneId={route.id} />;
    case "dashboard":
      return <DashboardView />;
    case "mock":
      return <MockView slug={route.slug} />;
  }
}
