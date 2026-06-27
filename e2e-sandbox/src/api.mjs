// sandbox-only — no stability contract
import { evaluate } from './parser.mjs';
/** @unstable Sandbox-only; no stability contract — do not use outside e2e tests. */
export function calc(expr) {
  if (typeof expr !== 'string') {
    throw new TypeError(`calc() expects a string expression, got ${typeof expr}`);
  }
  return evaluate(expr);
}
