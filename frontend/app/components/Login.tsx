"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { API_URL, IS_LOCAL_API, wakeApi } from "../lib/api";
import { AwsLogo, ChevronLeftIcon, TriangleDownIcon } from "./icons";
import { Alert, Button, Modal } from "./ui";

export type Session = { token: string; user: { email: string; name: string } };

type UserType = "root" | "iam";
type Step = "identify" | "password";

/** A blue "label ▾" link in the top-right corner that opens a small menu. */
function TopMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="signin-topmenu" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label} <TriangleDownIcon size={11} />
      </button>
      {open && (
        <div className="signin-menu" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Modal
      title="Provide feedback"
      size="small"
      onClose={onClose}
      footer={
        sent ? (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="link" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!text.trim()} onClick={() => setSent(true)}>
              Submit
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <Alert type="success" header="Thanks for your feedback">
          In this local demo feedback isn&apos;t sent anywhere.
        </Alert>
      ) : (
        <>
          <label htmlFor="feedback-text" className="signin-feedback-label">
            Tell us about your sign-in experience
          </label>
          <textarea id="feedback-text" className="text-input wide" rows={5} value={text} onChange={(event) => setText(event.target.value)} autoFocus />
        </>
      )}
    </Modal>
  );
}

/**
 * Mocked AWS sign-in modelled on the console's sign-in page. Root users give an email address and then a
 * password; IAM users give an account ID or alias, then a username and password. No AWS account is involved:
 * the API simply issues a demo session for any credentials.
 */
export function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [userType, setUserType] = useState<UserType>("root");
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(false);
  const [multiSession, setMultiSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [lastCheck, setLastCheck] = useState("");

  // Start waking the API as soon as the page opens, so it is usually ready by the time someone signs in.
  useEffect(() => {
    let active = true;
    wakeApi(() => active && !IS_LOCAL_API && setWaking(true), undefined, (detail) => active && setLastCheck(detail)).then(() => active && setWaking(false));
    return () => {
      active = false;
    };
  }, []);

  const identity = userType === "root" ? email.trim() : `${username.trim()}@${account.trim()}`;

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (userType === "root" && !email.trim()) return setError("Enter the email address of your root user.");
    if (userType === "iam" && !account.trim()) return setError("Enter your account ID or alias.");
    setError("");
    setStep("password");
  };

  const back = () => {
    setStep("identify");
    setError("");
    setPassword("");
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (userType === "iam" && !username.trim()) return setError("Enter your IAM username.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError("");
    try {
      if (!(await wakeApi(() => !IS_LOCAL_API && setWaking(true), undefined, setLastCheck))) throw new Error("API unavailable");
      setWaking(false);
      const response = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: identity }) });
      if (!response.ok) throw new Error();
      onSignedIn(await response.json());
    } catch {
      setWaking(false);
      setError(
        IS_LOCAL_API
          ? `Can't reach the API at ${API_URL}. Start the backend first: cd backend && uvicorn app.main:app --port 8000`
          : "The demo server isn't responding. It runs on free hosting that sleeps when idle, so please try again in a minute.",
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseType = (type: UserType) => {
    setUserType(type);
    setError("");
  };

  return (
    <div className="signin-page">
      <div className="signin-top">
        <button type="button" className="signin-toplink" onClick={() => setFeedback(true)}>
          Provide feedback
        </button>
        <TopMenu label={multiSession ? "Multi-session enabled" : "Multi-session disabled"}>
          {(close) => (
            <>
              <p>Multi-session lets you sign in to more than one AWS account in the same browser.</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMultiSession(!multiSession);
                  close();
                }}
              >
                {multiSession ? "Disable multi-session" : "Enable multi-session"}
              </button>
            </>
          )}
        </TopMenu>
        <TopMenu label="English">
          {(close) => (
            <>
              <button type="button" role="menuitem" className="selected" onClick={close}>
                English
              </button>
              <p>More languages aren&apos;t available in this demo.</p>
            </>
          )}
        </TopMenu>
      </div>

      <header className="signin-logo">
        <AwsLogo dark width={90} />
      </header>

      <div className="signin-layout">
        <section className="signin-card" aria-labelledby="signin-title">
          {step === "identify" ? (
            <form onSubmit={next} noValidate>
              <h1 id="signin-title">Sign In</h1>
              <p className="signin-lede">Access your AWS account by user type.</p>
              <fieldset className="signin-types">
                <legend>
                  User type{" "}
                  <a href="https://docs.aws.amazon.com/signin/latest/userguide/console-sign-in-tutorials.html" target="_blank" rel="noreferrer">
                    (not sure?)
                  </a>
                </legend>
                <label className={`signin-tile ${userType === "root" ? "selected" : ""}`}>
                  <input type="radio" name="user-type" checked={userType === "root"} onChange={() => chooseType("root")} />
                  <span>
                    Root user
                    <small>Account owner that performs tasks requiring unrestricted access.</small>
                  </span>
                </label>
                <label className={`signin-tile ${userType === "iam" ? "selected" : ""}`}>
                  <input type="radio" name="user-type" checked={userType === "iam"} onChange={() => chooseType("iam")} />
                  <span>
                    IAM user
                    <small>User within an account that performs daily tasks.</small>
                  </span>
                </label>
              </fieldset>
              {userType === "root" ? (
                <label className="signin-field">
                  <span>Email address</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="username@example.com" autoComplete="username" autoFocus />
                </label>
              ) : (
                <label className="signin-field">
                  <span>Account ID or alias</span>
                  <input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="123456789012" autoComplete="off" autoFocus />
                </label>
              )}
              {error && (
                <p className="signin-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="signin-primary">
                Next
              </button>
            </form>
          ) : (
            <form onSubmit={signIn} noValidate>
              <h1 id="signin-title">{userType === "root" ? "Root user sign in" : "IAM user sign in"}</h1>
              <button type="button" className="signin-back" onClick={back}>
                <ChevronLeftIcon size={13} /> {userType === "root" ? email : `Account ${account}`}
              </button>
              {userType === "iam" && (
                <label className="signin-field">
                  <span>IAM username</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus />
                </label>
              )}
              <label className="signin-field">
                <span>Password</span>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus={userType === "root"} />
              </label>
              <div className="signin-row">
                <label className="signin-check">
                  <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} /> Show Password
                </label>
                <button type="button" className="signin-dotted" onClick={() => setNotice("Password reset isn't available in this local demo. Any password signs you in.")}>
                  {userType === "root" ? "Forgot password?" : "Having trouble?"}
                </button>
              </div>
              {error && (
                <p className="signin-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="signin-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <p className="signin-hint">This is a local demo: any password works and nothing is checked against AWS.</p>
            </form>
          )}
          {waking && (
            <Alert type="info" header="Waking up the demo server" className="signin-notice">
              It runs on free hosting that sleeps when idle, so the first sign-in can take up to a minute. You can keep going; this page continues automatically.
              {lastCheck && <small className="signin-diagnostic">Latest check: {lastCheck}.</small>}
            </Alert>
          )}
          <div className="signin-or">
            <span>OR</span>
          </div>
          <button type="button" className="signin-secondary" onClick={() => setNotice("Account creation is disabled in this local demo. Use any email address or username to sign in.")}>
            New to AWS? Sign up
          </button>
          {notice && (
            <Alert type="info" className="signin-notice" onDismiss={() => setNotice(null)}>
              {notice}
            </Alert>
          )}
        </section>

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

        <aside className="signin-promo" aria-label="Featured story">
          <h2>Route traffic to your applications with Amazon Route 53</h2>
          <p>A highly available and scalable DNS web service. Manage hosted zones, records and routing policies in one place.</p>
          <a href="https://aws.amazon.com/route53/" target="_blank" rel="noreferrer">
            Get started <span aria-hidden="true">→</span>
          </a>
        </aside>
      </div>

      <footer className="signin-footer">© 2026 Amazon Web Services, Inc. or its affiliates. All rights reserved.</footer>
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}
