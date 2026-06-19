import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tagMeta, noActionLabel } from '../meta.js';
import { DispositionTag } from '../design-system/components/core/DispositionTag.jsx';
import Button from './Button.jsx';
import Confirmation from './Confirmation.jsx';
import { Callout } from '../design-system/components/core/Callout.jsx';
import { TextButton } from '../design-system/components/core/TextButton.jsx';
import { TerminalNote } from '../design-system/components/feedback/TerminalNote.jsx';

const mono = 'var(--font-mono)';

// react-markdown escapes raw HTML by default (no dangerouslySetInnerHTML), so
// untrusted reviewer/bot comment bodies can't execute script — safe to render.
const mdComponents = {
  a: (p) => <a {...p} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }} />,
  code: (p) => (
    <code
      {...p}
      style={{ fontFamily: mono, fontSize: '0.9em', background: 'var(--surface-2)', padding: '1px 4px', borderRadius: 'var(--radius-chip)' }}
    />
  ),
  p: (p) => <p {...p} style={{ margin: '0 0 6px' }} />,
};

// hash-out: rebuttal textarea + Discuss / Send; resolves to a sent-rebuttal block.
// The textarea is pre-filled with the worker's suggested reply (Phase 1) when it
// drafted one; the user edits or sends as-is.
function HashOutControls({ thread, prId, dash }) {
  const [text, setText] = useState(thread.suggestedReply || '');
  const status = dash.threadStatus(thread.id);
  const staged = dash.isStaged ? dash.isStaged(prId, thread.id) : false;
  const dispatched = dash.isDispatched ? dash.isDispatched(prId, thread.id) : false;

  if (status === 'rebutted') {
    return (
      <>
        <div style={{ marginTop: 11 }}>
          <Callout tone="quiet">You: {dash.threadRebuttal(thread.id)}</Callout>
        </div>
        <Confirmation text="✓ Reply posted to the reviewer." fg="var(--auto-fg)" />
      </>
    );
  }

  return (
    <>
      {status === 'discussing' && (
        <TerminalNote>Terminal session opened — continue the discussion there.</TerminalNote>
      )}

      {thread.suggestedApproach && (
        <div style={{ marginTop: 11 }}>
        <Callout tone="agent" eyebrow="Suggested approach">
          {thread.suggestedApproach}
          <div style={{ marginTop: 9 }}>
            {dispatched ? (
              <span style={{ fontSize: 12.5, color: 'var(--auto-fg)' }}>⟳ The agent is applying this approach…</span>
            ) : staged ? (
              <span style={{ fontSize: 12.5, color: 'var(--auto-fg)' }}>✓ Approved — staged for the next agent run.</span>
            ) : (
              <>
                <Button variant="primary" onClick={() => dash.stageApproach(prId, thread.id)}>
                  Approve approach
                </Button>
                {/* To change the approach, hash it out in the terminal (the Discuss
                    button below) rather than editing it inline. */}
                <div style={{ marginTop: 7, fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  Want changes? Discuss in terminal below.
                </div>
              </>
            )}
          </div>
        </Callout>
        </div>
      )}

      {thread.suggestedReply && (
        <div style={{ marginTop: 9, fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          ↓ The agent drafted this reply — edit or send as-is.
        </div>
      )}
      <textarea
        className="input"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your reply to the reviewer — push back, clarify, or make the call."
        style={{
          marginTop: 11,
          width: '100%',
          resize: 'vertical',
          font: '13.5px/1.5 var(--font-sans)',
          padding: '10px 12px',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface)',
          color: 'var(--ink)',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
        <Button variant="primary" onClick={() => dash.discuss(thread.id)}>
          Discuss in terminal
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (dash.sendRebuttal(thread.id, text)) setText('');
          }}
        >
          Send reply
        </Button>
      </div>
    </>
  );
}

// notYetReviewed: the worker hasn't reviewed this thread yet — it's queued, no CTA.
// Two distinct states: "agent working…" (a worker is running now for this PR)
// vs "no feedback yet" (none queued/running).
function PendingControls({ working }) {
  return (
    <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
      {working ? 'The agent is reviewing this thread now…' : 'The agent hasn’t reviewed this thread yet.'}
    </div>
  );
}

// error: cannot-classify caption + Open in terminal.
function ErrorControls({ thread, dash }) {
  const status = dash.threadStatus(thread.id);
  if (status === 'discussing') return <TerminalNote>Terminal session opened.</TerminalNote>;
  return (
    <>
      <div style={{ marginTop: 11, fontSize: 12.5, color: 'var(--ink-2)' }}>
        The agent couldn’t classify this automatically.
      </div>
      <div style={{ marginTop: 9 }}>
        <Button variant="outline" onClick={() => dash.discuss(thread.id)}>
          Open in terminal
        </Button>
      </div>
    </>
  );
}

export default function ThreadRow({ thread, prId, dash }) {
  const working = dash.prWorking ? dash.prWorking(prId) : false;
  const meta = tagMeta[thread.tag];
  const [expanded, setExpanded] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  // Long bodies clamp to a few lines and expand on demand; short ones fit fully.
  const isLong = (thread.body || '').length > 280;
  // The agent's reasoning can be a long paragraph (esp. on surfaced threads). Keep
  // the row scannable: collapse it by default behind a quiet toggle when it's long.
  const reasonLong = (thread.reason || '').length > 140;
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
        <DispositionTag tone={meta.tone}>{meta.label}</DispositionTag>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--ink-3)' }}>{thread.loc}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--ink-2)' }}>{thread.author}</span>
      </div>

      <div
        className="md-body"
        style={{
          marginTop: 9,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--ink)',
          textWrap: 'pretty',
          ...(isLong && !expanded
            ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 4, overflow: 'hidden' }
            : {}),
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {thread.body}
        </ReactMarkdown>
      </div>
      {isLong && (
        <div style={{ marginTop: 4 }}>
          <TextButton tone="muted" underline={false} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show more'}
          </TextButton>
        </div>
      )}

      {thread.reason && (
        reasonLong ? (
          <div style={{ marginTop: 7 }}>
            <TextButton tone="muted" underline={false} onClick={() => setReasonOpen((v) => !v)}>
              {reasonOpen ? '↳ Hide agent’s reasoning' : '↳ Show agent’s reasoning'}
            </TextButton>
            {reasonOpen && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, display: 'flex', gap: 7, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--ink-3)' }}>↳</span>
                <span>{thread.reason}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 7, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--ink-3)' }}>↳</span>
            <span>{thread.reason}</span>
          </div>
        )
      )}

      {thread.tag === 'needsYourApproval' && <HashOutControls thread={thread} prId={prId} dash={dash} />}
      {thread.tag === 'notYetReviewed' && <PendingControls working={working} />}
      {thread.tag === 'agentError' && <ErrorControls thread={thread} dash={dash} />}
      {(thread.tag === 'agentAutoFixed' || thread.tag === 'awaitingReviewer' || thread.tag === 'agentAcknowledged') && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {thread.tag === 'agentAutoFixed' ? 'The agent fixed this — waiting on the reviewer to confirm.' : noActionLabel(thread.tag)}
        </div>
      )}
    </div>
  );
}
