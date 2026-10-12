"use client";

import { ReactNode, useRef, useState } from "react";
import { useDismiss } from "../../lib/hooks";
import { TriangleDownIcon } from "../common/icons";

/** A blue "label ▾" link in the top-right corner that opens a small menu. */
export function TopMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, setOpen);
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
