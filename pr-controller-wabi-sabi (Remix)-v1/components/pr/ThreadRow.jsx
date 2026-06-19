import React from "react";
import { DispositionTag } from "../core/DispositionTag.jsx";
import { Button } from "../core/Button.jsx";
import { TextButton } from "../core/TextButton.jsx";
import { Confirmation } from "../feedback/Confirmation.jsx";
import { TerminalNote } from "../feedback/TerminalNote.jsx";

const mono = "var(--font-mono)";

const TAGS = {
  input: { tone: "accent", label: "needs your input" },
  fixed: { tone: "sage", label: "agent fixed · waiting on reviewer" },
  waiting: { tone: "neutral", label: "waiting on reviewer" },
  pending: { tone: "pending", label: "no feedback yet" },
  praise: { tone: "praise", label: "praise" },
  error: { tone: "ochre", label: "agent error" },
};

const eyebrow = { fontFamily: mono, fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--ink-3)" };
const noAction = { marginTop: 10, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" };

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
          <div style={{ marginTop: 12, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-card)", padding: "12px 13px" }}>
            <div style={{ ...eyebrow, marginBottom: 7 }}>Suggested approach</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--ink)", textWrap: "pretty" }}>{thread.approach}</div>
            {staged ? (
              <Confirmation text="✓ Approach staged — runs with this PR’s next agent run." fg="var(--auto-fg)" onUndo={() => c.unstageApproach(id)} />
            ) : (
              <div style={{ marginTop: 11 }}>
                <Button variant="primary" onClick={() => c.approveApproach(id)}>Approve approach</Button>
              </div>
            )}
          </div>
        )}
        {thread.reply &&
          (sent ? (
            <>
              <div style={{ marginTop: 11, background: "var(--surface-2)", borderLeft: "2px solid var(--line-2)", padding: "9px 12px", borderRadius: "0 5px 5px 0", fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>
                You: {c.replyText(id)}
              </div>
              <Confirmation text="✓ Reply sent to the reviewer." fg="var(--auto-fg)" onUndo={() => c.undoReply(id)} />
            </>
          ) : (
            <>
              <div style={{ ...eyebrow, marginTop: 12 }}>Suggested reply · editable</div>
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                style={{ marginTop: 7, width: "100%", resize: "vertical", font: "13.5px/1.5 var(--font-sans)", padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: "var(--radius-card)", background: "var(--surface)", color: "var(--ink)" }}
              />
              <div style={{ marginTop: 9 }}>
                <Button variant="primary" onClick={() => c.sendReply(id, reply)}>Send reply</Button>
              </div>
            </>
          ))}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={() => c.discuss(id)}>Discuss in terminal</Button>
          {c.threadTerminalOpen(id) && <TerminalNote>Terminal session opened…</TerminalNote>}
        </div>
      </>
    );
  } else if (thread.tag === "error") {
    controls = (
      <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button variant="outline" onClick={() => c.discuss(id)}>Open in terminal</Button>
        {c.threadTerminalOpen(id) && <TerminalNote>Terminal session opened…</TerminalNote>}
      </div>
    );
  } else if (thread.tag === "pending") {
    controls = <div style={noAction}>The agent is reviewing this now…</div>;
  } else {
    controls = (
      <div style={noAction}>
        {thread.tag === "praise"
          ? "No action needed — positive feedback."
          : thread.tag === "fixed"
          ? "No action needed — waiting on the reviewer to confirm."
          : "No action needed — waiting on the reviewer."}
      </div>
    );
  }

  const clamp = isLong && !bodyOpen ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } : null;

  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9 }}>
        <DispositionTag tone={tag.tone}>{tag.label}</DispositionTag>
        <span style={{ fontFamily: mono, fontSize: 12, color: "var(--ink-3)" }}>{thread.loc}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: "var(--ink-2)" }}>{thread.author}</span>
      </div>
      <div style={{ marginTop: 9, fontSize: 14, lineHeight: 1.5, color: "var(--ink)", textWrap: "pretty", ...clamp }}>{thread.body}</div>
      {isLong && (
        <div style={{ marginTop: 5 }}>
          <TextButton tone="accent" underline={false} onClick={() => setBodyOpen((v) => !v)}>{bodyOpen ? "Show less" : "Show more"}</TextButton>
        </div>
      )}
      <div style={{ marginTop: 9, fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 7, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ color: "var(--ink-3)" }}>↳</span>
        <span style={{ flex: 1, minWidth: 140 }}>{thread.reasonSummary}</span>
        <span style={{ flex: "none" }}>
          <TextButton tone="accent" underline={false} onClick={() => setReasonOpen((v) => !v)}>{reasonOpen ? "Hide agent’s reasoning" : "Show agent’s reasoning"}</TextButton>
        </span>
      </div>
      {reasonOpen && (
        <div style={{ marginTop: 7, marginLeft: 14, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)", fontStyle: "italic", borderLeft: "2px solid var(--line-2)", paddingLeft: 11 }}>
          {thread.reasonFull || thread.reasonSummary}
        </div>
      )}
      {controls}
    </div>
  );
}
