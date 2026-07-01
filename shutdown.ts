// Pure decision for how a shutdown signal (SIGTERM/SIGINT) should be handled.
//
// The first signal always starts the graceful drain. The question is what a SECOND
// signal means, and that's answered by the signal TYPE, not timing:
//
//   - SIGTERM comes from a machine (task runner, launchd, redeploy). Those send
//     SIGTERM exactly ONCE, then SIGKILL after their own timeout — they never send a
//     second SIGTERM as "impatience". A duplicate SIGTERM is instead an artifact of
//     the launch topology: when `node` isn't the process-group leader (a wrapper shell
//     leads the group), a stopper that signals BOTH the group and the pid lands the
//     same SIGTERM on node twice, ~1ms apart. So a duplicate SIGTERM is ALWAYS the
//     same logical stop — coalesce it and let the drain finish. If the drain hangs,
//     the orchestrator's uncatchable SIGKILL is the hard backstop.
//   - SIGINT comes from an interactive human (Ctrl-C). A second Ctrl-C IS a deliberate
//     "I'm done waiting" — honor it with an immediate force-exit.
//
// The old handler force-exited on any second signal, which skipped the worker drain on
// every machine stop (issue #57) — the machine-delivered duplicate SIGTERM was never
// the impatient human the comment assumed.
export type ShutdownAction = 'start' | 'ignore-duplicate' | 'force-exit';

export function shutdownAction(started: boolean, signal: string): ShutdownAction {
  if (!started) return 'start';
  return signal === 'SIGINT' ? 'force-exit' : 'ignore-duplicate';
}
