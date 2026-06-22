// public calc API
import { evaluate } from './parser.mjs';
export function calc(expr) {
  return evaluate(expr);
}
