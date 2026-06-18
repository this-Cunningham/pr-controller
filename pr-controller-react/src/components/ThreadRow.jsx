import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tagMeta, noActionLabel } from '../meta.js';
import Button from './Button.jsx';
import Confirmation from './Confirmation.jsx';

const mono = "'IBM Plex Mono', monospace";

// react-markdown escapes raw HTML by default (no dangerouslySetInnerHTML), so
// untrusted reviewer/bot comment bodies can't execute script — safe to render.
const mdComponents = {
  a: (p) => <a {...p} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }} />,
  code: (p) => (
    <code
      {...p}
      style={{ fontFamily: mono, fontSize: '0.9em', background: 'var(--surface-2)', padding: '1px 4px', borderRadius: 3 }}
    />
  ),
  p: (p) => <p {...p} style={{ margin: '0 0 6px' }} />,
};

function TerminalNote({ children }) {
  return (
    <div
      style={{
        marginTop: 11,
        fontSize: 12.5,
        color: 'var(--ink-2)',
        display: 'flex',
        gap: 7,
        alignItems: 'center',
        animation: 'appear .3s ease',
      }}
    >
      <span style={{ fontFamily: mono, color: 'var(--accent)' }}>›_</span>
      {children}
    </div>
  );
}

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
        <div
          style={{
            marginTop: 11,
            background: 'var(--surface-2)',
            borderLeft: '2px solid var(--line-2)',
            padding: '9px 12px',
            borderRadius: '0 5px 5px 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--ink-2)',
          }}
        >
          You: {dash.threadRebuttal(thread.id)}
        </div>
        <Confirmation text="✓ Rebuttal posted to the reviewer." fg="var(--auto-fg)" />
      </>
    );
  }

  return (
    <>
      {status === 'discussing' && (
        <TerminalNote>Terminal session opened — continue the discussion there.</TerminalNote>
      )}

      {thread.suggestedApproach && (
        <div
          style={{
            marginTop: 11,
            background: 'var(--auto-bg)',
            borderLeft: '2px solid var(--auto-fg)',
            padding: '9px 12px',
            borderRadius: '0 5px 5px 0',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--ink-2)',
          }}
        >
          <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--auto-fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Suggested approach
          </span>
          <div style={{ marginTop: 5 }}>{thread.suggestedApproach}</div>
          <div style={{ marginTop: 9 }}>
            {dispatched ? (
              <span style={{ fontSize: 12.5, color: 'var(--auto-fg)' }}>⟳ The agent is applying this approach…</span>
            ) : staged ? (
              <span style={{ fontSize: 12.5, color: 'var(--auto-fg)' }}>✓ Approved — staged for the next agent run.</span>
            ) : (
              <Button variant="primary" onClick={() => dash.stageApproach(prId, thread.id)}>
                Approve approach
              </Button>
            )}
          </div>
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
        placeholder="Why do you disagree? This goes back to the reviewer."
        style={{
          marginTop: 11,
          width: '100%',
          resize: 'vertical',
          font: "13.5px/1.5 'Hanken Grotesk', sans-serif",
          padding: '10px 12px',
          border: '1px solid var(--line-2)',
          borderRadius: 5,
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
          Send rebuttal
        </Button>
      </div>
    </>
  );
}

// agree-fix: auto-handled by the backend poller — informational only, no CTAs.
function AgreeControls() {
  return (
    <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
      The agent is auto-handling this fix.
    </div>
  );
}

// pending: the worker hasn't reviewed this thread yet — it's queued, no CTA.
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
  // Long bodies clamp to a few lines and expand on demand; short ones fit fully.
  const isLong = (thread.body || '').length > 280;
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
        <span
          style={{
            fontFamily: mono,
            fontSize: 10.5,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 4,
            background: meta.bg,
            color: meta.fg,
          }}
        >
          {meta.label}
        </span>
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
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 4,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            font: "500 12px 'Hanken Grotesk', sans-serif",
            color: 'var(--ink-2)',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div
        style={{
          marginTop: 7,
          fontSize: 12.5,
          color: 'var(--ink-2)',
          display: 'flex',
          gap: 7,
          alignItems: 'baseline',
        }}
      >
        <span style={{ color: 'var(--ink-3)' }}>↳</span>
        <span>{thread.reason}</span>
      </div>

      {thread.tag === 'hashout' && <HashOutControls thread={thread} prId={prId} dash={dash} />}
      {thread.tag === 'agree' && <AgreeControls />}
      {thread.tag === 'pending' && <PendingControls working={working} />}
      {thread.tag === 'error' && <ErrorControls thread={thread} dash={dash} />}
      {(thread.tag === 'waiting' || thread.tag === 'praise') && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {noActionLabel(thread.tag)}
        </div>
      )}
    </div>
  );
}
