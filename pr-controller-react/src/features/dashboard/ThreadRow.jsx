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
 * One reviewer comment thread inside a PR card. A pure presentational component:
 * the body clamp, reasoning toggle and reply draft are local UI state; everything
 * durable arrives as props — the thread's data plus its handlers/state, already
 * bound to this (PR, thread) by the parent. No controller, no context.
 *
 *   input   → up to two agent-drafted aids: a "Suggested approach" (onApprove stages
 *             it into the PR's cart) and/or a pre-filled, editable "Suggested reply"
 *             (onSendReply); plus Discuss in terminal. When the thread carries
 *             `approaches[]` (1–3) instead of a single `approach`, they render as
 *             selectable radio-cards with trade-off tags — the picked one drives the
 *             drafted reply and is what onApprove(index) stages.
 *   error   → Open in terminal.
 *   pending → "no feedback yet" caption (agent reviewing now).
 *   fixed / waiting / praise → no actions, just a caption.
 */
export function ThreadRow({
  thread,
  staged = false,
  replySent = false,
  sentReplyText = "",
  terminalOpen = false,
  onApprove,
  onUnstage,
  onSendReply,
  onUndoReply,
  onDiscuss,
}) {
  const tag = TAGS[thread.tag] || TAGS.waiting;
  const [bodyOpen, setBodyOpen] = React.useState(false);
  const [reasonOpen, setReasonOpen] = React.useState(false);
  // Multi-approach (input only): thread.approaches = [{ title, body, trade?, reply? }] (1–3).
  // `choice` is the selected card (local, transient UI); the chosen one drives the reply
  // default and is what Approve stages. `draft` (null = use the computed default) lets the
  // user edit the reply, and re-defaults when they pick a different approach.
  const [choice, setChoice] = React.useState(0);
  const [draft, setDraft] = React.useState(null);
  const approaches =
    thread.tag === "input" && Array.isArray(thread.approaches) && thread.approaches.length ? thread.approaches : null;
  const clampedChoice = approaches ? Math.max(0, Math.min(approaches.length - 1, choice)) : 0;
  const chosen = approaches ? approaches[clampedChoice] : null;
  const replyDefault = chosen && chosen.reply ? chosen.reply : thread.reply || "";
  const reply = draft == null ? replyDefault : draft;
  const showReply = thread.tag === "input" && (!!thread.reply || (approaches && approaches.some((a) => a.reply)));
  const isLong = (thread.body || "").length > 150;
  // The worker emits a single reason; adapt.js only sets reasonFull when it's genuinely
  // longer than the inline summary. No extra text -> no toggle, no empty expandable div.
  const hasMoreReason = !!thread.reasonFull && thread.reasonFull !== thread.reasonSummary;

  let controls = null;
  if (thread.tag === "input") {
    controls = (
      <>
        {approaches ? (
          // Multi-approach: pick one of 1–3 drafted approaches (sage selection); the
          // chosen one is what Approve stages. Once staged, the card collapses to the
          // chosen approach + an undo.
          <div className={styles.approachCard}>
            <div className={`${styles.eyebrow} ${styles.approachEyebrow}`}>
              {staged ? "Approach staged" : "Suggested approaches · pick one"}
            </div>
            {staged ? (
              <>
                <div className={styles.stagedApproach}>
                  <div className={styles.approachTitleRow}>
                    <span className={styles.approachTitle}>{chosen.title}</span>
                    {chosen.trade && <span className={styles.approachTrade}>{chosen.trade}</span>}
                  </div>
                  <div className={styles.approachBody}>{chosen.body}</div>
                </div>
                <Confirmation text={`✓ “${chosen.title}” staged — runs with this PR’s next agent run.`} fg="var(--auto-fg)" onUndo={onUnstage} />
              </>
            ) : (
              <>
                <div className={styles.optionList}>
                  {approaches.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      className={styles.option}
                      data-selected={i === clampedChoice ? "true" : undefined}
                      onClick={() => { setChoice(i); setDraft(null); }}
                    >
                      <span className={styles.optionDot} data-selected={i === clampedChoice ? "true" : undefined}>
                        <span className={styles.optionDotInner} />
                      </span>
                      <span className={styles.optionMain}>
                        <span className={styles.approachTitleRow}>
                          <span className={styles.approachTitle}>{a.title}</span>
                          {a.trade && <span className={styles.approachTrade}>{a.trade}</span>}
                        </span>
                        <span className={styles.approachBody}>{a.body}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className={styles.approveRow}>
                  <Button variant="primary" onClick={() => onApprove(clampedChoice)}>Approve selected</Button>
                </div>
              </>
            )}
          </div>
        ) : thread.approach ? (
          <div className={styles.approachCard}>
            <div className={`${styles.eyebrow} ${styles.approachEyebrow}`}>Suggested approach</div>
            <div className={styles.approachText}>{thread.approach}</div>
            {staged ? (
              <Confirmation text="✓ Approach staged — runs with this PR’s next agent run." fg="var(--auto-fg)" onUndo={onUnstage} />
            ) : (
              <div className={styles.approveRow}>
                <Button variant="primary" onClick={onApprove}>Approve approach</Button>
              </div>
            )}
          </div>
        ) : null}
        {showReply &&
          (replySent ? (
            <>
              <div className={styles.replyQuote}>You: {sentReplyText}</div>
              <Confirmation text="✓ Reply sent to the reviewer." fg="var(--auto-fg)" onUndo={onUndoReply} />
            </>
          ) : (
            <>
              <div className={`${styles.eyebrow} ${styles.replyEyebrow}`}>Suggested reply · editable</div>
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setDraft(e.target.value)}
                className={styles.replyInput}
              />
              <div className={styles.sendRow}>
                <Button variant="primary" onClick={() => onSendReply(reply)}>Send reply</Button>
              </div>
            </>
          ))}
        <div className={styles.actionRow}>
          <Button variant="outline" onClick={onDiscuss}>Discuss in terminal</Button>
          {terminalOpen && <TerminalNote>Terminal session opened…</TerminalNote>}
        </div>
      </>
    );
  } else if (thread.tag === "error") {
    controls = (
      <div className={styles.errorRow}>
        <Button variant="outline" onClick={onDiscuss}>Open in terminal</Button>
        {terminalOpen && <TerminalNote>Terminal session opened…</TerminalNote>}
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
        {hasMoreReason && (
          <span className={styles.reasonToggle}>
            <TextButton tone="accent" underline={false} onClick={() => setReasonOpen((v) => !v)}>{reasonOpen ? "Hide agent’s reasoning" : "Show agent’s reasoning"}</TextButton>
          </span>
        )}
      </div>
      {hasMoreReason && reasonOpen && (
        <div className={`${styles.reasonFull} ws-appear`}>{thread.reasonFull}</div>
      )}
      {controls}
    </div>
  );
}
