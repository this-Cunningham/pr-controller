import { useState } from 'react';
import { tagMeta, noActionLabel } from '../meta.js';
import Button from './Button.jsx';
import Confirmation from './Confirmation.jsx';

const mono = "'IBM Plex Mono', monospace";

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
function HashOutControls({ thread, dash }) {
  const [text, setText] = useState('');
  const status = dash.threadStatus(thread.id);

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
        <Confirmation
          text="✓ Rebuttal sent to the reviewer."
          fg="var(--auto-fg)"
          onUndo={() => dash.undo(thread.id)}
        />
      </>
    );
  }

  return (
    <>
      {status === 'discussing' && (
        <TerminalNote>Terminal session opened — continue the discussion there.</TerminalNote>
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

// agree-fix: Approve / Skip; resolves to a confirmation with Undo.
function AgreeControls({ thread, dash }) {
  const status = dash.threadStatus(thread.id);

  if (status === 'approved') {
    return (
      <Confirmation
        text="✓ Fix approved — applied by the agent."
        fg="var(--auto-fg)"
        onUndo={() => dash.undo(thread.id)}
      />
    );
  }
  if (status === 'skipped') {
    return <Confirmation text="Skipped — left for you." onUndo={() => dash.undo(thread.id)} />;
  }
  return (
    <>
      <div style={{ marginTop: 11, fontSize: 12.5, color: 'var(--ink-2)' }}>
        The agent will apply this fix.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
        <Button variant="primary" onClick={() => dash.approve(thread.id)}>
          Approve fix
        </Button>
        <Button variant="ghost" onClick={() => dash.skip(thread.id)}>
          Skip
        </Button>
      </div>
    </>
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

export default function ThreadRow({ thread, dash }) {
  const meta = tagMeta[thread.tag];
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
        style={{
          marginTop: 9,
          maxHeight: 88,
          overflowY: 'auto',
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--ink)',
          paddingRight: 6,
          textWrap: 'pretty',
        }}
      >
        {thread.body}
      </div>

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

      {thread.tag === 'hashout' && <HashOutControls thread={thread} dash={dash} />}
      {thread.tag === 'agree' && <AgreeControls thread={thread} dash={dash} />}
      {thread.tag === 'error' && <ErrorControls thread={thread} dash={dash} />}
      {(thread.tag === 'waiting' || thread.tag === 'praise') && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {noActionLabel(thread.tag)}
        </div>
      )}
    </div>
  );
}
