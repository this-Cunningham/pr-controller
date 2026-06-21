import React from "react";
import { Button } from "../../design-system/core/Button.jsx";
import styles from "./JiraBanner.module.css";

/**
 * Compliance banner shown on a PR card when the title is missing a
 * ticket key. Pending → input + Set ticket. Linked → confirmation.
 */
export function JiraBanner({ pr, controller }) {
  const [value, setValue] = React.useState("");
  const linked = controller.jiraValue(pr.id);

  if (linked) {
    return (
      <div className={styles.wrap}>
        <div className={`${styles.linked} ws-appear`}>✓ Linked to {linked} — compliance check cleared.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.head}>
          <span className={styles.mark}>◆</span>
          <div className={styles.line}>
            This PR’s title is missing a ticket key — the compliance check failed. Add one to continue.
          </div>
        </div>
        <div className={styles.inputRow}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ABC-123"
            className={styles.input}
          />
          <Button variant="primary" onClick={() => { if (controller.setTicket(pr.id, value) !== false) setValue(""); }}>
            Set ticket
          </Button>
        </div>
      </div>
    </div>
  );
}
