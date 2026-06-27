// Tiny dependency-free leveled logger for the daemon. Replaces ad-hoc console.* so
// every line carries a level + ISO timestamp + tag, filterable via PRC_LOG_LEVEL
// (debug|info|warn|error, default info), with an optional one-line-JSON mode
// (PRC_LOG_JSON=1) for machine ingestion. Pure stdout/stderr — no deps, no files.
//
// Usage: `const log = logger('poll'); log.info('scanned', { prs: 3 })`. For a
// per-item tag, make a logger inline: `logger(`worker ${prKey}`).warn('...')`.
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold =
  LEVELS[(process.env.PRC_LOG_LEVEL || 'info').toLowerCase() as Level] ?? LEVELS.info;
const asJson = process.env.PRC_LOG_JSON === '1' || process.env.PRC_LOG_JSON === 'true';

// PURE: would a message at `level` be emitted under the current threshold? Exported
// so callers can skip building an expensive `extra` payload when it'd be dropped.
export function isEnabled(level: Level): boolean {
  return (LEVELS[level] ?? LEVELS.info) >= threshold;
}

function emit(level: Level, tag: string, msg: string, extra?: unknown): void {
  if (!isEnabled(level)) return;
  const ts = new Date().toISOString();
  const sink = level === 'error' || level === 'warn' ? console.error : console.log;
  if (asJson) {
    const rec: { ts: string; level: Level; tag: string; msg: string; extra?: unknown } =
      { ts, level, tag, msg };
    if (extra !== undefined) rec.extra = extra;
    sink(JSON.stringify(rec));
    return;
  }
  const line = `${ts} ${level.toUpperCase().padEnd(5)} [${tag}] ${msg}`;
  sink(extra !== undefined ? `${line} ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : line);
}

/** A tagged logger's method set. The variadic `...rest` lets callers pass a single
 *  `extra` payload (the only arg `emit` forwards) without a TS2554 arity error. */
type LogFn = (msg: string, ...rest: unknown[]) => void;
export interface Logger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

// A tagged logger. The `tag` mirrors today's `[bracket]` prefixes (poll, dispatch,
// worker, scanner, cleanup, …) so log greps keep working.
export function logger(tag: string): Logger {
  return {
    debug: (msg, extra) => emit('debug', tag, msg, extra),
    info: (msg, extra) => emit('info', tag, msg, extra),
    warn: (msg, extra) => emit('warn', tag, msg, extra),
    error: (msg, extra) => emit('error', tag, msg, extra),
  };
}
