// sandbox-only — no stability contract
import { evaluate } from './parser.mjs';
/** @unstable Sandbox-only; no stability contract — do not use outside e2e tests. */
export function calc(expr) {
  return evaluate(expr);
}
