"use client";

import { TriangleDownIcon } from "../common/icons";

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="filter-select">
      <select aria-label={label} value={value} className={value ? "has-value" : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <TriangleDownIcon size={10} className="select-caret" />
    </div>
  );
}
