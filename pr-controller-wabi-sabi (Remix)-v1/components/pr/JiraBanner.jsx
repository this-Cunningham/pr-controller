import React from "react";
import { Button } from "../core/Button.jsx";

/**
 * Compliance banner shown on a PR card when the title is missing a
 * ticket key. Pending → input + Set ticket. Linked → confirmation.
 */
export function JiraBanner({ pr, controller }) {
  const [value, setValue] = React.useState("");
  const linked = controller.jiraValue(pr.id);

  if (linked) {
    return (
      <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ fontSize: 12.5, color: "var(--auto-fg)", animation: "ws-appear .3s ease" }}>
          ✓ Linked to {linked} — compliance check cleared.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-bg)", borderRadius: "var(--radius-card)", padding: "13px 14px" }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ color: "var(--accent)", fontSize: 12, lineHeight: 1.5 }}>◆</span>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)" }}>
            This PR’s title is missing a ticket key — the compliance check failed. Add one to continue.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ABC-123"
            style={{ font: "13px var(--font-mono)", textTransform: "uppercase", padding: "8px 11px", width: 140, border: "1px solid var(--line-2)", borderRadius: "var(--radius-card)", background: "var(--surface)", color: "var(--ink)" }}
          />
          <Button variant="primary" onClick={() => { if (controller.setTicket(pr.id, value) !== false) setValue(""); }}>
            Set ticket
          </Button>
        </div>
      </div>
    </div>
  );
}
