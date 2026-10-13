"use client";

import { useState } from "react";
import { useConsole } from "../../lib/console";
import type { Tag, Zone } from "../../lib/types";
import { Column, DataTable, useSort } from "../common/DataTable";
import { Button, Container, Modal, Pagination, SearchInput } from "../common/ui";
import { hasDuplicateTags, TagEditor } from "./TagEditor";

const COLUMNS: Column<Tag>[] = [
  { id: "key", header: "Key", width: 400, sortValue: (tag) => tag.key, cell: (tag) => tag.key },
  { id: "value", header: "Value", width: 500, sortValue: (tag) => tag.value, cell: (tag) => tag.value || "-" },
];

export function TagsTab({ zone, onChanged }: { zone: Zone; onChanged: () => void }) {
  const { api, notify, notifyError } = useConsole();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState(false);
  const rows = zone.tags.filter((tag) => `${tag.key} ${tag.value}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const { sorted, sort, toggle } = useSort(rows, COLUMNS, { id: "key", desc: false });

  const save = async (tags: Tag[]) => {
    try {
      await api.put(`/zones/${zone.id}/tags`, { tags: tags.filter((tag) => tag.key.trim()) });
      notify({ type: "success", header: "Tags updated successfully." });
      setManaging(false);
      onChanged();
    } catch (error) {
      notifyError("Unable to update tags", error);
    }
  };

  return (
    <Container
      title="Tags"
      info="tags"
      actions={<Button onClick={() => setManaging(true)}>Manage tags</Button>}
    >
      <div className="filter-row">
        <SearchInput value={filter} onChange={(value) => { setFilter(value); setPage(1); }} placeholder="Search" className="filter-wide" />
        <Pagination page={page} pages={1} onChange={setPage} />
      </div>
      <DataTable label="Tags" columns={COLUMNS} rows={sorted} rowKey={(tag) => tag.key} sort={sort} onSort={toggle} empty={filter ? "No tags match your search." : "No tags associated with the resource."} />
      {managing && <ManageTagsModal tags={zone.tags} onCancel={() => setManaging(false)} onSave={save} />}
    </Container>
  );
}

function ManageTagsModal({ tags, onCancel, onSave }: { tags: Tag[]; onCancel: () => void; onSave: (tags: Tag[]) => void }) {
  const [draft, setDraft] = useState<Tag[]>(tags);
  const duplicates = hasDuplicateTags(draft);
  return (
    <Modal
      title="Manage tags"
      size="large"
      onClose={onCancel}
      footer={
        <>
          <Button variant="link" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={duplicates} onClick={() => onSave(draft)}>
            Save changes
          </Button>
        </>
      }
    >
      <TagEditor tags={draft} onChange={setDraft} />
    </Modal>
  );
}
