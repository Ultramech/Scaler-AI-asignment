"use client";

import { ButtonHTMLAttributes, ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { useConsole } from "../lib/console";
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  ErrorCircleIcon,
  GearIcon,
  InfoCircleIcon,
  MinusCircleIcon,
  SearchIcon,
  WarningIcon,
} from "./icons";

/* ------------------------------------------------------------------ buttons */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "normal" | "primary" | "link" | "inline-link" };

export function Button({ variant = "normal", className = "", type = "button", children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ label, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={`icon-btn ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** The circular refresh button used in table headers. */
export function RoundIconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="round-btn" {...rest}>
      {children}
    </button>
  );
}

export function InfoLink({ topic }: { topic: string }) {
  const { openHelp } = useConsole();
  return (
    <button type="button" className="info-link" onClick={() => openHelp(topic)}>
      Info
    </button>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { notify } = useConsole();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify({ type: "success", header: "Copied to clipboard" });
    } catch {
      notify({ type: "error", header: "Unable to copy to the clipboard" });
    }
  };
  return (
    <IconButton label={label} className="copy-btn" onClick={copy}>
      <CopyIcon size={14} />
    </IconButton>
  );
}

/* -------------------------------------------------------------------- modal */

export function Modal({ title, onClose, footer, children, size = "medium" }: { title: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode; size?: "small" | "medium" | "large" }) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("input:not([disabled]), button.btn-primary, .modal-close")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select, textarea, a[href]")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialog} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <header className="modal-header">
          <h2>{title}</h2>
          <IconButton label="Close modal" className="modal-close" onClick={onClose}>
            <CloseIcon size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- alerts */

const ALERT_ICONS = { success: CheckCircleIcon, error: ErrorCircleIcon, warning: WarningIcon, info: InfoCircleIcon };

export function Alert({ type = "info", header, children, action, onDismiss, className = "" }: { type?: "success" | "error" | "warning" | "info"; header?: ReactNode; children?: ReactNode; action?: ReactNode; onDismiss?: () => void; className?: string }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert-${type} ${className}`} role={type === "error" ? "alert" : "status"}>
      <Icon size={18} className="alert-icon" />
      <div className="alert-text">
        {header && <strong>{header}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="alert-action">{action}</div>}
      {onDismiss && (
        <IconButton label="Dismiss" onClick={onDismiss}>
          <CloseIcon size={16} />
        </IconButton>
      )}
    </div>
  );
}

/** Dismissible notification bar shown at the top of the content area. */
export function Flashbar() {
  const { flashes, dismiss } = useConsole();
  if (!flashes.length) return null;
  return (
    <div className="flashbar" aria-live="polite">
      {flashes.map((flash) => (
        <Alert key={flash.id} type={flash.type} header={flash.header} onDismiss={() => dismiss(flash.id)} className="flash">
          {flash.content}
        </Alert>
      ))}
    </div>
  );
}

export function StatusIndicator({ kind, children }: { kind: "success" | "error" | "stopped" | "info"; children: ReactNode }) {
  const Icon = { success: CheckCircleIcon, error: ErrorCircleIcon, stopped: MinusCircleIcon, info: InfoCircleIcon }[kind];
  return (
    <span className={`status status-${kind}`}>
      <Icon size={15} /> {children}
    </span>
  );
}

/* ------------------------------------------------------------------ forms */

export function Field({ label, info, optional, description, hint, error, htmlFor, children, className = "" }: { label: ReactNode; info?: string; optional?: boolean; description?: ReactNode; hint?: ReactNode; error?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <div className="field-label">
        <label htmlFor={htmlFor}>
          {label}
          {optional && <i> - optional</i>}
        </label>
        {info && <InfoLink topic={info} />}
      </div>
      {description && <div className="field-description">{description}</div>}
      {children}
      {error ? <div className="field-error">{error}</div> : hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, children, disabled, id, ariaLabel }: { checked: boolean; onChange: (value: boolean) => void; children?: ReactNode; disabled?: boolean; id?: string; ariaLabel?: string }) {
  return (
    <label className={`toggle ${disabled ? "disabled" : ""}`}>
      <input id={id} type="checkbox" role="switch" aria-label={ariaLabel} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      {children && <span className="toggle-label">{children}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Filter records by property or value", inputRef, className = "", label }: { value: string; onChange: (value: string) => void; placeholder?: string; inputRef?: RefObject<HTMLInputElement | null>; className?: string; label?: string }) {
  return (
    <div className={`search-input ${className}`}>
      <SearchIcon size={16} />
      <input ref={inputRef} type="search" value={value} placeholder={placeholder} aria-label={label ?? placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function SelectBox({ value, onChange, options, label, className = "" }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string; className?: string }) {
  return (
    <select className={`select-box ${className}`} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------- pagination */

export function Pagination({ page, pages, onChange, onSettings }: { page: number; pages: number; onChange: (page: number) => void; onSettings?: () => void }) {
  const numbers = pageWindow(page, pages);
  return (
    <div className="pagination">
      <nav aria-label="Pagination">
        <button type="button" className="page-arrow" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeftIcon size={14} />
        </button>
        {numbers.map((entry, index) =>
          entry === "…" ? (
            <span key={`gap-${index}`} className="page-gap">
              …
            </span>
          ) : (
            <button type="button" key={entry} className={`page-number ${entry === page ? "current" : ""}`} aria-current={entry === page ? "page" : undefined} onClick={() => onChange(entry)}>
              {entry}
            </button>
          ),
        )}
        <button type="button" className="page-arrow" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <ChevronRightIcon size={14} />
        </button>
      </nav>
      {onSettings && (
        <button type="button" className="page-settings" aria-label="Preferences" title="Preferences" onClick={onSettings}>
          <GearIcon size={18} />
        </button>
      )}
    </div>
  );
}

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const set = new Set([1, 2, page - 1, page, page + 1, pages - 1, pages].filter((value) => value >= 1 && value <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("…");
    result.push(value);
  });
  return result;
}

/* ------------------------------------------------------------- containers */

export function Container({ title, info, description, actions, children, className = "" }: { title?: ReactNode; info?: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`container ${className}`}>
      {(title || actions) && (
        <div className="container-header">
          {title && (
            <h2>
              <span>{title}</span>
              {info && <InfoLink topic={info} />}
            </h2>
          )}
          {actions && <div className="container-actions">{actions}</div>}
        </div>
      )}
      {description && <p className="container-description">{description}</p>}
      {children}
    </section>
  );
}

export function PageHeader({ title, info, description, actions }: { title: ReactNode; info?: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>
          <span>{title}</span>
          {info && <InfoLink topic={info} />}
        </h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Loading({ children = "Loading" }: { children?: ReactNode }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" /> {children}
    </div>
  );
}

/** Small hook for disclosure sections ("Hosted zone details", "Additional configuration"...). */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return { open, toggle: () => setOpen((value) => !value), setOpen };
}
