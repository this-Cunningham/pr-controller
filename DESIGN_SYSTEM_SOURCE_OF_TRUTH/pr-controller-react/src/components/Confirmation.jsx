// Confirmation line shown after an action, with an optional Undo link.
export default function Confirmation({ text, fg = 'var(--ink-2)', onUndo }) {
  return (
    <div
      style={{
        marginTop: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        animation: 'appear .3s ease',
      }}
    >
      <span style={{ fontSize: 12.5, color: fg }}>{text}</span>
      {onUndo && (
        <button
          type="button"
          className="undo"
          onClick={onUndo}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            font: "12.5px 'Hanken Grotesk', sans-serif",
            color: 'var(--accent)',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
