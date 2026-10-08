"use client";

import type { Tag } from "../lib/types";
import { Button } from "./ui";

export const MAX_TAGS = 50;

/** Key/value rows with "Add tag" and per-row "Remove", as used on the create, edit and manage-tags screens. */
export function TagEditor({ tags, onChange }: { tags: Tag[]; onChange: (tags: Tag[]) => void }) {
  const update = (index: number, patch: Partial<Tag>) => onChange(tags.map((tag, position) => (position === index ? { ...tag, ...patch } : tag)));
  const duplicate = (index: number) => tags[index].key.trim() !== "" && tags.findIndex((tag) => tag.key.trim() === tags[index].key.trim()) !== index;
  return (
    <div className="tag-editor">
      {tags.length === 0 ? (
        <p className="no-tags">No tags associated with the resource.</p>
      ) : (
        <div className="tag-rows">
          <div className="tag-row tag-row-head">
            <span>Key</span>
            <span>Value - optional</span>
          </div>
          {tags.map((tag, index) => (
            <div className="tag-row" key={index}>
              <div>
                <input className="text-input" value={tag.key} maxLength={128} placeholder="Enter key" aria-label={`Tag ${index + 1} key`} onChange={(event) => update(index, { key: event.target.value })} />
                {duplicate(index) && <div className="field-error">Tag keys must be unique.</div>}
              </div>
              <input className="text-input" value={tag.value} maxLength={256} placeholder="Enter value" aria-label={`Tag ${index + 1} value`} onChange={(event) => update(index, { value: event.target.value })} />
              <Button onClick={() => onChange(tags.filter((_, position) => position !== index))}>Remove</Button>
            </div>
          ))}
        </div>
      )}
      <Button onClick={() => onChange([...tags, { key: "", value: "" }])} disabled={tags.length >= MAX_TAGS}>
        Add tag
      </Button>
      <p className="field-hint">You can add up to {MAX_TAGS - tags.length} more tags.</p>
    </div>
  );
}

export const hasDuplicateTags = (tags: Tag[]) => {
  const keys = tags.map((tag) => tag.key.trim()).filter(Boolean);
  return new Set(keys).size !== keys.length;
};
