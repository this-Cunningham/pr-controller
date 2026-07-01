// Pure decision for how a shutdown signal (SIGTERM/SIGINT) should be handled.
//
// The daemon is often launched so that `node` is NOT the process-group leader
// (a wrapper shell leads the group). A stopper that signals BOTH the group and
// the pid then delivers the SAME signal to node twice, ~1ms apart. The old
// handler treated that machine-delivered duplicate like an impatient human
// double-Ctrl-C and force-exited (skipping the worker drain). We instead coalesce
// a same-signal duplicate that lands inside a short window into one logical stop,
// while still honoring a genuinely-later second signal (a human who got tired of
// waiting on the drain) as a force-exit.
export type ShutdownAction = 'start' | 'ignore-duplicate' | 'force-exit';

export function shutdownAction(
  started: boolean,
  msSinceFirst: number,
  debounceMs: number,
): ShutdownAction {
  if (!started) return 'start';
  if (msSinceFirst <= debounceMs) return 'ignore-duplicate';
  return 'force-exit';
}
