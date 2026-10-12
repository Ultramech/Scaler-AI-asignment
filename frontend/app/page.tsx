"use client";

import { useCallback, useEffect, useState } from "react";
import { Login, Session } from "./components/auth/Login";
import { ConsoleProvider } from "./lib/console";
import { readStorage, writeStorage } from "./lib/storage";
import { Route, useRoute } from "./lib/router";
import { CreateRecordView } from "./views/CreateRecordView";
import { CreateZoneView } from "./views/CreateZoneView";
import { EditRecordView } from "./views/EditRecordView";
import { EditZoneView } from "./views/EditZoneView";
import { ImportView } from "./views/ImportView";
import { MockView } from "./views/MockView";
import { ZoneDetailView } from "./views/ZoneDetailView";
import { ZonesView } from "./views/ZonesView";

const SESSION_KEY = "r53-session";

function loadSession(): Session | null {
  const saved = readStorage(SESSION_KEY);
  try {
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
    writeStorage(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const signOut = useCallback(() => {
    writeStorage(SESSION_KEY, null);
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
    case "mock":
      return <MockView slug={route.slug} />;
  }
}
