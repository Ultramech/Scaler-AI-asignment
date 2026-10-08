"use client";

import { FormEvent, useState } from "react";
import { API_URL } from "../lib/api";
import { Alert, Button } from "./ui";

export type Session = { token: string; user: { email: string; name: string } };

/** Mocked sign-in: no AWS account or credential is involved, the API just issues a demo session. */
export function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [workspace, setWorkspace] = useState("route53-demo");
  const [email, setEmail] = useState("demo@aws.local");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace.trim()) return setError("Enter a local workspace name.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!response.ok) throw new Error();
      onSignedIn(await response.json());
    } catch {
      setError("Unable to reach the local Route 53 demo API. Make sure the backend is running on port 8000.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand" aria-hidden="true">
        <span>Route</span>
        <b>53</b>
      </div>
      <form className="login-card" onSubmit={signIn}>
        <h1>Local demo sign in</h1>
        <label>
          Local workspace name
          <input className="text-input" value={workspace} onChange={(event) => setWorkspace(event.target.value)} autoFocus />
        </label>
        <label>
          Demo email
          <input className="text-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error && <Alert type="error">{error}</Alert>}
        <Button variant="primary" type="submit" disabled={busy} className="login-submit">
          Sign in
        </Button>
        <div className="login-divider">
          <span>LOCAL MOCK</span>
        </div>
        <p className="login-note">This assignment uses a local demo session. No AWS account or credentials are requested or stored.</p>
      </form>
    </div>
  );
}
