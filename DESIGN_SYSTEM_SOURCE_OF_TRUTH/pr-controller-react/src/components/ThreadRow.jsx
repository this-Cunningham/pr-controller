import { useState } from 'react';
import { tagMeta, noActionLabel } from '../meta.js';
import Button from './Button.jsx';
import Confirmation from './Confirmation.jsx';

const mono = "'IBM Plex Mono', monospace";
const eyebrow = { fontFamily: mono, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' };

function TerminalNote({ children = 'Terminal session opened…' }) {
  return (
    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', display: 'inline-flex', gap: 6, alignItems: 'center', animation: 'appear .3s ease' }}>
      <span style={{ fontFamily: mono, color: 'var(--accent)' }}>›_</span>
      {children}
    </span>
  );
}

// needs your input: up to two agent-drafted aids (suggested approach that
// stages into the PR cart, and/or a pre-filled editable reply) + Discuss.
function InputControls({ thread, dash }) {
  const [reply, setReply] = useState(thread.reply || '');
  const staged = dash.approachStaged(thread.id);
  const sent = dash.replySent(thread.id);
  return (
    <>
      {thread.approach && (
        <div style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '12px 13px' }}>
          <div style={{ ...eyebrow, marginBottom: 7 }}>Suggested approach</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)', textWrap: 'pretty' }}>{thread.approach}</div>
          {staged ? (
            <Confirmation text="✓ Approach staged — runs with this PR’s next agent run." fg="var(--auto-fg)" onUndo={() => dash.unstageApproach(thread.id)} />
          ) : (
            <div style={{ marginTop: 11 }}>
              <Button variant="primary" onClick={() => dash.approveApproach(thread.id)}>Approve approach</Button>
            </div>
          )}
        </div>
      )}
      {thread.reply &&
        (sent ? (
          <>
            <div style={{ marginTop: 11, background: 'var(--surface-2)', borderLeft: '2px solid var(--line-2)', padding: '9px 12px', borderRadius: '0 5px 5px 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
              You: {dash.replyText(thread.id)}
            </div>
            <Confirmation text="✓ Reply sent to the reviewer." fg="var(--auto-fg)" onUndo={() => dash.undoReply(thread.id)} />
          </>
        ) : (
          <>
            <div style={{ ...eyebrow, marginTop: 12 }}>Suggested reply · editable</div>
            <textarea
              className="input"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              style={{ marginTop: 7, width: '100%', resize: 'vertical', font: "13.5px/1.5 'Hanken Grotesk', sans-serif", padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: 5, background: 'var(--surface)', color: 'var(--ink)' }}
            />
            <div style={{ marginTop: 9 }}>
              <Button variant="primary" onClick={() => dash.sendReply(thread.id, reply)}>Send reply</Button>
            </div>
          </>
        ))}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="outline" onClick={() => dash.discuss(thread.id)}>Discuss in terminal</Button>
        {dash.threadTerminalOpen(thread.id) && <TerminalNote />}
      </div>
    </>
  );
}

function ErrorControls({ thread, dash }) {
  return (
    <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <Button variant="outline" onClick={() => dash.discuss(thread.id)}>Open in terminal</Button>
      {dash.threadTerminalOpen(thread.id) && <TerminalNote />}
    </div>
  );
}

export default function ThreadRow({ thread, dash }) {
  const meta = tagMeta[thread.tag];
  const [bodyOpen, setBodyOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const isLong = (thread.body || '').length > 150;
  const clamp = isLong && !bodyOpen ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {};

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
            border: meta.dashed ? '1px dashed var(--line-2)' : '1px solid transparent',
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--ink-3)' }}>{thread.loc}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--ink-2)' }}>{thread.author}</span>
      </div>

      <div style={{ marginTop: 9, fontSize: 14, lineHeight: 1.5, color: 'var(--ink)', textWrap: 'pretty', ...clamp }}>{thread.body}</div>
      {isLong && (
        <a onClick={() => setBodyOpen((v) => !v)} style={{ display: 'inline-block', marginTop: 5, fontSize: 12.5, color: 'var(--accent)', cursor: 'pointer' }}>
          {bodyOpen ? 'Show less' : 'Show more'}
        </a>
      )}

      <div style={{ marginTop: 9, fontSize: 12.5, color: 'var(--ink-2)', display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ink-3)' }}>↳</span>
        <span style={{ flex: 1, minWidth: 140 }}>{thread.reasonSummary}</span>
        <a onClick={() => setReasonOpen((v) => !v)} style={{ flex: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}>
          {reasonOpen ? 'Hide agent’s reasoning' : 'Show agent’s reasoning'}
        </a>
      </div>
      {reasonOpen && (
        <div style={{ marginTop: 7, marginLeft: 14, fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)', fontStyle: 'italic', borderLeft: '2px solid var(--line-2)', paddingLeft: 11 }}>
          {thread.reasonFull || thread.reasonSummary}
        </div>
      )}

      {thread.tag === 'input' && <InputControls thread={thread} dash={dash} />}
      {thread.tag === 'error' && <ErrorControls thread={thread} dash={dash} />}
      {thread.tag === 'pending' && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>The agent is reviewing this now…</div>
      )}
      {(thread.tag === 'fixed' || thread.tag === 'waiting' || thread.tag === 'praise') && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>{noActionLabel(thread.tag)}</div>
      )}
    </div>
  );
}
