"use client";

import { Button, Modal } from "../common/ui";

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Alt", "S"], action: "Focus the global search" },
  { keys: ["/"], action: "Focus the filter of the current table" },
  { keys: ["N"], action: "Create a record (hosted zone page)" },
  { keys: ["C"], action: "Create a hosted zone (hosted zones page)" },
  { keys: ["R"], action: "Refresh the current table" },
  { keys: ["?"], action: "Show keyboard shortcuts" },
  { keys: ["Esc"], action: "Close a dialog or clear the search" },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Keyboard shortcuts"
      size="small"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.action}>
              <td>
                {shortcut.keys.map((key, index) => (
                  <span key={key}>
                    {index > 0 && " + "}
                    <kbd>{key}</kbd>
                  </span>
                ))}
              </td>
              <td>{shortcut.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
