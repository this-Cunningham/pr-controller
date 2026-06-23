// sandbox-only — no stability contract
import { evaluate } from './parser.mjs';
export function calc(expr) {
  return evaluate(expr);
}
