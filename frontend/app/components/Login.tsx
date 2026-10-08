"use client";

import { FormEvent, useState } from "react";
import { API_URL } from "../lib/api";
import { ChevronLeftIcon } from "./icons";
import { AwsLogo } from "./icons";
import { Alert } from "./ui";

export type Session = { token: string; user: { email: string; name: string } };

type UserType = "root" | "iam";

/**
 * Mocked AWS sign-in. It mirrors the console's two steps (user type + username, then password),
 * but no AWS account is involved: the API simply issues a demo session for any credentials.
 */
export function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [userType, setUserType] = useState<UserType>("root");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"username" | "password">("username");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false);

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim()) return setError("Enter your username.");
    setError("");
    setStep("password");
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: username.trim() }) });
      if (!response.ok) throw new Error();
      onSignedIn(await response.json());
    } catch {
      setError("Unable to reach the Route 53 demo API. If it was idle, wait a few seconds and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin-page">
      <header className="signin-logo">
        <AwsLogo dark width={150} />
      </header>
      <div className="signin-layout">
        <section className="signin-card" aria-labelledby="signin-title">
          <h1 id="signin-title">Sign In</h1>
          {step === "username" ? (
            <form onSubmit={next} noValidate>
              <p className="signin-lede">Access your AWS account by user type.</p>
              <fieldset className="signin-types">
                <legend>
                  User type{" "}
                  <a href="https://docs.aws.amazon.com/signin/latest/userguide/console-sign-in-tutorials.html" target="_blank" rel="noreferrer">
                    (not sure?)
                  </a>
                </legend>
                <label className={`signin-tile ${userType === "root" ? "selected" : ""}`}>
                  <input type="radio" name="user-type" checked={userType === "root"} onChange={() => setUserType("root")} />
                  <span>
                    <strong>Root user</strong>
                    <small>Account owner that performs tasks requiring unrestricted access.</small>
                  </span>
                </label>
                <label className={`signin-tile ${userType === "iam" ? "selected" : ""}`}>
                  <input type="radio" name="user-type" checked={userType === "iam"} onChange={() => setUserType("iam")} />
                  <span>
                    <strong>IAM user</strong>
                    <small>User within an account that performs daily tasks.</small>
                  </span>
                </label>
              </fieldset>
              <label className="signin-field">
                <span>Username</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" autoComplete="username" autoFocus />
              </label>
              {error && <p className="signin-error" role="alert">{error}</p>}
              <button type="submit" className="signin-primary">
                Next
              </button>
            </form>
          ) : (
            <form onSubmit={signIn} noValidate>
              <button type="button" className="signin-back" onClick={() => { setStep("username"); setError(""); setPassword(""); }}>
                <ChevronLeftIcon size={14} /> {userType === "root" ? "Root user" : "IAM user"} · {username}
              </button>
              <label className="signin-field">
                <span>Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" autoFocus />
              </label>
              <p className="signin-hint">This is a local demo: any password works and nothing is checked against AWS.</p>
              {error && <p className="signin-error" role="alert">{error}</p>}
              <button type="submit" className="signin-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
          <div className="signin-or">
            <span>OR</span>
          </div>
          <button type="button" className="signin-secondary" onClick={() => setNotice(true)}>
            New to AWS? Sign up
          </button>
          {notice && (
            <Alert type="info" className="signin-notice" onDismiss={() => setNotice(false)}>
              Account creation is disabled in this local demo. Use any username to sign in.
            </Alert>
          )}
          <p className="signin-legal">
            By continuing, you agree to{" "}
            <a href="https://aws.amazon.com/agreement/" target="_blank" rel="noreferrer">
              AWS Customer Agreement
            </a>{" "}
            or other agreement for AWS services, and the{" "}
            <a href="https://aws.amazon.com/privacy/" target="_blank" rel="noreferrer">
              Privacy Notice
            </a>
            . This site uses essential cookies. See our{" "}
            <a href="https://aws.amazon.com/legal/cookies/" target="_blank" rel="noreferrer">
              Cookie Notice
            </a>{" "}
            for more information.
          </p>
        </section>
        <aside className="signin-promo" aria-label="Featured story">
          <h2>AWS is how fans get closer to the world&apos;s game</h2>
          <p>See how Bundesliga transforms 200M data points into AI-powered experiences that connect every fan to the game</p>
          <a href="https://aws.amazon.com/" target="_blank" rel="noreferrer">
            Explore Now <span aria-hidden="true">→</span>
          </a>
        </aside>
      </div>
    </div>
  );
}
