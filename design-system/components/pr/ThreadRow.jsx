import React from "react";
import { DispositionTag } from "../core/DispositionTag.jsx";
import { Button } from "../core/Button.jsx";
import { Confirmation } from "../feedback/Confirmation.jsx";

const mono = "var(--font-mono)";

const TAGS = {
  hashout: { tone: "accent", label: "disagree · hash out" },
  agree: { tone: "sage", label: "agree · auto-fix" },
  waiting: { tone: "neutral", label: "waiting on reviewer" },
  praise: { tone: "praise", label: "praise" },
  error: { tone: "ochre", label: "agent error" },
};

function TerminalNote({ children }) {
  return (
    <div style={{ marginTop: 11, fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 7, alignItems: "center", animation: "ws-appear .3s ease" }}>
      <span style={{ fontFamily: mono, color: "var(--accent)" }}>›_</span>
      {children}
    </div>
  );
}

/**
 * One reviewer comment thread inside a PR card. Controls vary by the
 * agent's disposition tag. Stateful behavior is delegated to `controller`.
 */
export function ThreadRow({ thread, controller }) {
  const [text, setText] = React.useState("");
  const status = controller.threadStatus(thread.id);
  const tag = TAGS[thread.tag] || TAGS.waiting;
  const id = thread.id;

  let controls = null;
  if (thread.tag === "hashout") {
    if (status === "rebutted") {
      controls = (
        <>
          <div style={{ marginTop: 11, background: "var(--surface-2)", borderLeft: "2px solid var(--line-2)", padding: "9px 12px", borderRadius: "0 5px 5px 0", fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>
            You: {controller.threadRebuttal(id)}
          </div>
          <Confirmation text="✓ Rebuttal sent to the reviewer." fg="var(--auto-fg)" onUndo={() => controller.undo(id)} />
        </>
      );
    } else {
      controls = (
        <>
          {status === "discussing" && <TerminalNote>Terminal session opened — continue the discussion there.</TerminalNote>}
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Why do you disagree? This goes back to the reviewer."
            style={{ marginTop: 11, width: "100%", resize: "vertical", font: "13.5px/1.5 var(--font-sans)", padding: "10px 12px", border: "1px solid var(--line-2)", borderRadius: "var(--radius-card)", background: "var(--surface)", color: "var(--ink)" }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
            <Button variant="primary" onClick={() => controller.discuss(id)}>Discuss in terminal</Button>
            <Button variant="outline" onClick={() => { if (controller.sendRebuttal(id, text) !== false) setText(""); }}>Send rebuttal</Button>
          </div>
        </>
      );
    }
  } else if (thread.tag === "agree") {
    if (status === "approved") controls = <Confirmation text="✓ Fix approved — applied by the agent." fg="var(--auto-fg)" onUndo={() => controller.undo(id)} />;
    else if (status === "skipped") controls = <Confirmation text="Skipped — left for you." onUndo={() => controller.undo(id)} />;
    else
      controls = (
        <>
          <div style={{ marginTop: 11, fontSize: 12.5, color: "var(--ink-2)" }}>The agent will apply this fix.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
            <Button variant="primary" onClick={() => controller.approve(id)}>Approve fix</Button>
            <Button variant="ghost" onClick={() => controller.skip(id)}>Skip</Button>
          </div>
        </>
      );
  } else if (thread.tag === "error") {
    controls =
      status === "discussing" ? (
        <TerminalNote>Terminal session opened.</TerminalNote>
      ) : (
        <>
          <div style={{ marginTop: 11, fontSize: 12.5, color: "var(--ink-2)" }}>The agent couldn’t classify this automatically.</div>
          <div style={{ marginTop: 9 }}>
            <Button variant="outline" onClick={() => controller.discuss(id)}>Open in terminal</Button>
          </div>
        </>
      );
  } else {
    controls = (
      <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-3)", fontStyle: "italic" }}>
        {thread.tag === "praise" ? "No action needed — positive feedback." : "No action needed — waiting on the reviewer."}
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9 }}>
        <DispositionTag tone={tag.tone}>{tag.label}</DispositionTag>
        <span style={{ fontFamily: mono, fontSize: 12, color: "var(--ink-3)" }}>{thread.loc}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: "var(--ink-2)" }}>{thread.author}</span>
      </div>
      <div style={{ marginTop: 9, maxHeight: 88, overflowY: "auto", fontSize: 14, lineHeight: 1.5, color: "var(--ink)", paddingRight: 6 }}>{thread.body}</div>
      <div style={{ marginTop: 7, fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 7, alignItems: "baseline" }}>
        <span style={{ color: "var(--ink-3)" }}>↳</span>
        <span>{thread.reason}</span>
      </div>
      {controls}
    </div>
  );
}
