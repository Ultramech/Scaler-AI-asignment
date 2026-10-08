"use client";

import { useState } from "react";
import type { TablePreferences } from "../lib/hooks";
import { Button, Modal, Toggle } from "./ui";

const PAGE_SIZES = [10, 30, 50, 100] as const;
const SEARCH_MODES: { value: TablePreferences["searchMode"]; description: string }[] = [
  { value: "Automatic", description: "The service chooses a filter mode based on the total number of items." },
  { value: "Full", description: "All search filters are available, but search performance might be slower." },
  { value: "Fast", description: "Some advanced searches may not be available, but search performance will be faster." },
];

export function searchModeSentence(mode: TablePreferences["searchMode"]) {
  if (mode === "Full") return "Full mode is the current search behavior with all search filters available.";
  if (mode === "Fast") return "Fast mode is the current search behavior optimized for search performance.";
  return "Automatic mode is the current search behavior optimized for best filter results.";
}

/** The table "Preferences" dialog: page size, line wrapping, search mode and visible columns. */
export function PreferencesModal({ columns, value, onConfirm, onCancel }: { columns: { id: string; header: string }[]; value: TablePreferences; onConfirm: (value: TablePreferences) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  const toggleColumn = (id: string, visible: boolean) => setDraft((current) => ({ ...current, hidden: visible ? current.hidden.filter((entry) => entry !== id) : [...current.hidden, id] }));

  return (
    <Modal
      title="Preferences"
      size="large"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm(draft)}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="prefs">
        <div className="prefs-left">
          <fieldset>
            <legend>Page size</legend>
            {PAGE_SIZES.map((size) => (
              <label key={size} className="radio-row">
                <input type="radio" name="page-size" checked={draft.pageSize === size} onChange={() => setDraft({ ...draft, pageSize: size })} />
                {size} items
              </label>
            ))}
          </fieldset>
          <label className="check-row">
            <input type="checkbox" checked={draft.wrapLines} onChange={(event) => setDraft({ ...draft, wrapLines: event.target.checked })} />
            <span>
              Wrap lines
              <small>Check to see all the text and wrap the lines.</small>
            </span>
          </label>
          <fieldset>
            <legend>Search mode</legend>
            {SEARCH_MODES.map((mode) => (
              <label key={mode.value} className="radio-row radio-described">
                <input type="radio" name="search-mode" checked={draft.searchMode === mode.value} onChange={() => setDraft({ ...draft, searchMode: mode.value })} />
                <span>
                  {mode.value}
                  <small>{mode.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className="prefs-right">
          <h3>Select visible columns</h3>
          <h4>Properties</h4>
          <ul>
            {columns.map((column) => (
              <li key={column.id}>
                <span>{column.header}</span>
                <Toggle ariaLabel={column.header} checked={!draft.hidden.includes(column.id)} onChange={(visible) => toggleColumn(column.id, visible)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
