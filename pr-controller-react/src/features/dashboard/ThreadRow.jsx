import React from "react";
import { DispositionTag } from "../../design-system/core/DispositionTag.jsx";
import { Button } from "../../design-system/core/Button.jsx";
import { TextButton } from "../../design-system/core/TextButton.jsx";
import { Confirmation } from "../../design-system/feedback/Confirmation.jsx";
import { TerminalNote } from "./TerminalNote.jsx";
import styles from "./ThreadRow.module.css";

const TAGS = {
  input: { tone: "urgent", label: "needs your input" },
  fixed: { tone: "active", label: "agent fixed · waiting on reviewer" },
  waiting: { tone: "neutral", label: "waiting on reviewer" },
  pending: { tone: "pending", label: "no feedback yet" },
  praise: { tone: "praise", label: "praise" },
  error: { tone: "error", label: "agent error" },
};

/**
 * One reviewer comment thread inside a PR card. Controls vary by the
 * agent's disposition tag. Body clamp, reasoning toggle and the reply
 * draft are internal state; durable actions delegate to `controller`.
 *
 *   input   → up to two agent-drafted aids: a "Suggested approach"
 *             (Approve stages it into the PR's cart) and/or a pre-filled,
 *             editable "Suggested reply" (Send reply); plus Discuss in terminal.
 *   error   → Open in terminal.
 *   pending → "no feedback yet" caption (agent reviewing now).
 *   fixed / waiting / praise → no actions, just a caption.
 */
export function ThreadRow({ thread, controller: c }) {
  const id = thread.id;
  const tag = TAGS[thread.tag] || TAGS.waiting;
  const [reply, setReply] = React.useState(thread.reply || "");
  const [bodyOpen, setBodyOpen] = React.useState(false);
  const [reasonOpen, setReasonOpen] = React.useState(false);
  const isLong = (thread.body || "").length > 150;

  let controls = null;
  if (thread.tag === "input") {
    const staged = c.approachStaged(id);
    const sent = c.replySent(id);
    controls = (
      <>
        {thread.approach && (
          <div className={styles.approachCard}>
            <div className={`${styles.eyebrow} ${styles.approachEyebrow}`}>Suggested approach</div>
            <div className={styles.approachText}>{thread.approach}</div>
            {staged ? (
              <Confirmation text="✓ Approach staged — runs with this PR’s next agent run." fg="var(--auto-fg)" onUndo={() => c.unstageApproach(id)} />
            ) : (
              <div className={styles.approveRow}>
                <Button variant="primary" onClick={() => c.approveApproach(id)}>Approve approach</Button>
              </div>
            )}
          </div>
        )}
        {thread.reply &&
          (sent ? (
            <>
              <div className={styles.replyQuote}>You: {c.replyText(id)}</div>
              <Confirmation text="✓ Reply sent to the reviewer." fg="var(--auto-fg)" onUndo={() => c.undoReply(id)} />
            </>
          ) : (
            <>
              <div className={`${styles.eyebrow} ${styles.replyEyebrow}`}>Suggested reply · editable</div>
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className={styles.replyInput}
              />
              <div className={styles.sendRow}>
                <Button variant="primary" onClick={() => c.sendReply(id, reply)}>Send reply</Button>
              </div>
            </>
          ))}
        <div className={styles.actionRow}>
          <Button variant="outline" onClick={() => c.discuss(id)}>Discuss in terminal</Button>
          {c.threadTerminalOpen(id) && <TerminalNote>Terminal session opened…</TerminalNote>}
        </div>
      </>
    );
  } else if (thread.tag === "error") {
    controls = (
      <div className={styles.errorRow}>
        <Button variant="outline" onClick={() => c.discuss(id)}>Open in terminal</Button>
        {c.threadTerminalOpen(id) && <TerminalNote>Terminal session opened…</TerminalNote>}
      </div>
    );
  } else if (thread.tag === "pending") {
    controls = <div className={styles.noAction}>The agent is reviewing this now…</div>;
  } else {
    controls = (
      <div className={styles.noAction}>
        {thread.tag === "praise"
          ? "No action needed — positive feedback."
          : thread.tag === "fixed"
          ? "No action needed — waiting on the reviewer to confirm."
          : "No action needed — waiting on the reviewer."}
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.meta}>
        <DispositionTag tone={tag.tone}>{tag.label}</DispositionTag>
        <span className={styles.loc}>{thread.loc}</span>
        <span className={styles.author}>{thread.author}</span>
      </div>
      <div className={styles.body} data-clamp={isLong && !bodyOpen ? "true" : undefined}>{thread.body}</div>
      {isLong && (
        <div className={styles.showMore}>
          <TextButton tone="accent" underline={false} onClick={() => setBodyOpen((v) => !v)}>{bodyOpen ? "Show less" : "Show more"}</TextButton>
        </div>
      )}
      <div className={styles.reason}>
        <span className={styles.reasonArrow}>↳</span>
        <span className={styles.reasonSummary}>{thread.reasonSummary}</span>
        <span className={styles.reasonToggle}>
          <TextButton tone="accent" underline={false} onClick={() => setReasonOpen((v) => !v)}>{reasonOpen ? "Hide agent’s reasoning" : "Show agent’s reasoning"}</TextButton>
        </span>
      </div>
      {reasonOpen && (
        <div className={`${styles.reasonFull} ws-appear`}>{thread.reasonFull || thread.reasonSummary}</div>
      )}
      {controls}
    </div>
  );
}
