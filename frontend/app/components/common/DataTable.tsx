"use client";

import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { TriangleDownIcon, TriangleDownOutlineIcon, TriangleUpIcon } from "./icons";

export type Column<T> = {
  id: string;
  header: string;
  /** Initial width in pixels; users can drag the column edge to resize. */
  width: number;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
};

export type SortState = { id: string; desc: boolean } | null;
type Key = string | number;

/** Sorts rows by a column and exposes the click handler headers use to cycle ascending/descending. */
export function useSort<T>(rows: T[], columns: Column<T>[], initial: SortState = null) {
  const [sort, setSort] = useState<SortState>(initial);
  const sorted = useMemo(() => {
    const column = sort && columns.find((candidate) => candidate.id === sort.id);
    if (!sort || !column?.sortValue) return rows;
    const value = column.sortValue;
    const direction = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const order = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
      return order * direction;
    });
  }, [rows, columns, sort]);
  const toggle = useCallback((id: string) => setSort((current) => (current?.id === id ? { id, desc: !current.desc } : { id, desc: false })), []);
  return { sorted, sort, toggle };
}

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  /** Accessible name of a row's selection control. */
  rowLabel?: (row: T) => string;
  label: string;
  sort: SortState;
  onSort: (id: string) => void;
  selection?: "single" | "multiple";
  selected?: Set<Key>;
  onSelectionChange?: (selected: Set<Key>) => void;
  hidden?: string[];
  wrapLines?: boolean;
  loading?: boolean;
  empty: ReactNode;
};

export function DataTable<T>({ columns, rows, rowKey, rowLabel, label, sort, onSort, selection, selected = new Set(), onSelectionChange, hidden = [], wrapLines = false, loading, empty }: DataTableProps<T>) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const visible = columns.filter((column) => !hidden.includes(column.id));
  const widthOf = (column: Column<T>) => widths[column.id] ?? column.width;
  const total = visible.reduce((sum, column) => sum + widthOf(column), selection ? 44 : 0);
  const dragging = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const startResize = (event: React.MouseEvent, column: Column<T>) => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = { id: column.id, startX: event.clientX, startWidth: widthOf(column) };
    const move = (moveEvent: MouseEvent) => {
      const drag = dragging.current;
      if (drag) setWidths((current) => ({ ...current, [drag.id]: Math.max(60, drag.startWidth + moveEvent.clientX - drag.startX) }));
    };
    const stop = () => {
      dragging.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", stop);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", stop);
  };

  const toggleRow = (key: Key) => {
    if (!selection || !onSelectionChange) return;
    if (selection === "single") return onSelectionChange(new Set([key]));
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(rowKey(row)));
  const someSelected = rows.some((row) => selected.has(rowKey(row)));

  return (
    <div className={`table-scroll ${wrapLines ? "wrap-lines" : ""}`}>
      <table className="data-table" style={{ width: total, minWidth: "100%" }} aria-label={label} aria-busy={loading}>
        <colgroup>
          {selection && <col style={{ width: 44 }} />}
          {visible.map((column) => (
            <col key={column.id} style={{ width: widthOf(column) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {selection && (
              <th className="select-cell">
                {selection === "multiple" && (
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={(event) => onSelectionChange?.(event.target.checked ? new Set(rows.map(rowKey)) : new Set())}
                  />
                )}
              </th>
            )}
            {visible.map((column) => {
              const active = sort?.id === column.id;
              const sortable = Boolean(column.sortValue);
              return (
                <th key={column.id} aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
                  <div className="th-inner">
                    <button type="button" className="th-label" disabled={!sortable} onClick={() => onSort(column.id)} title={column.header}>
                      <span className="th-text">{column.header}</span>
                      {sortable && (
                        <span className={`sort-caret ${active ? "active" : ""}`}>{active ? sort.desc ? <TriangleDownIcon /> : <TriangleUpIcon /> : <TriangleDownOutlineIcon />}</span>
                      )}
                    </button>
                  </div>
                  <span className="resizer" role="separator" aria-orientation="vertical" onMouseDown={(event) => startResize(event, column)} />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const isSelected = selected.has(key);
            return (
              <tr key={key} className={isSelected ? "selected" : ""} onClick={() => toggleRow(key)}>
                {selection && (
                  <td className="select-cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type={selection === "single" ? "radio" : "checkbox"}
                      name={selection === "single" ? `${label}-select` : undefined}
                      aria-label={rowLabel ? `Select ${rowLabel(row)}` : `Select row ${key}`}
                      checked={isSelected}
                      onChange={() => toggleRow(key)}
                    />
                  </td>
                )}
                {visible.map((column) => (
                  <td key={column.id}>{column.cell(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <div className="table-empty">{loading ? "Loading…" : empty}</div>}
    </div>
  );
}
