#!/usr/bin/env node
// check-motion.mjs — guard against the CSS-modules keyframe-scoping trap. REPO-AGNOSTIC:
// resolves the repo + the src roots to scan from .design-sync.json, so it drops into any project.
//
// Vite's CSS-modules transform rescopes an `animation`/`animation-name` that names a keyframe from
// INSIDE a *.module.css (`ws-x` -> `_ws-x_hash`), so it matches no global @keyframes and the
// animation silently no-ops — no error, just dead UI. The canonical fix: define motion ONCE globally
// (a `.ws-NAME` utility class / `@keyframes ws-NAME` in a global stylesheet) and consume it from a
// module via `composes: ws-NAME from global`. (`ws-` is the convention prefix; override with --prefix.)
//
// Fails if any *.module.css: (a) inlines `animation`/`animation-name` naming a `<prefix>-*` keyframe,
// or (b) `composes: <prefix>-name from global` a class no global stylesheet defines.
//
// Usage: node scripts/check-motion.mjs [--repo <root>] [--prefix ws] [--warn]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";

const argFlag = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
function findRepo(start) {
  let d = resolve(start);
  for (;;) { if (existsSync(join(d, ".design-sync.json"))) return d; const p = dirname(d); if (p === d) return null; d = p; }
}
const REPO = argFlag("--repo", findRepo(process.cwd()) || process.cwd());
const PREFIX = argFlag("--prefix", "ws");
const STRICT = !process.argv.includes("--warn");
const cfg = existsSync(join(REPO, ".design-sync.json")) ? JSON.parse(readFileSync(join(REPO, ".design-sync.json"), "utf8")) : {};

// Src roots to scan: explicit `app.src` in config, else the `…/src` ancestor of each project's
// primitives/features dirs, else <repo>/src. Keeps the gate zero-config for the common layout.
function deriveSrcRoots() {
  if (cfg.app && Array.isArray(cfg.app.src) && cfg.app.src.length) return cfg.app.src;
  const roots = new Set();
  for (const p of Object.values(cfg.projects || {})) {
    for (const d of [p.primitives, ...(p.features || [])].filter(Boolean)) {
      const parts = d.split("/");
      const i = parts.lastIndexOf("src");
      if (i >= 0) roots.add(parts.slice(0, i + 1).join("/"));
    }
  }
  if (!roots.size && existsSync(join(REPO, "src"))) roots.add("src");
  return [...roots];
}
const SRC_ROOTS = deriveSrcRoots().map((r) => join(REPO, r)).filter(existsSync);
if (!SRC_ROOTS.length) {
  console.error("check-motion: no src roots found — set `app.src: [\"path/to/src\"]` in .design-sync.json.");
  process.exit(2);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const blankComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
const lineAt = (text, idx) => text.slice(0, idx).split("\n").length;
const kf = PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escaped prefix for regex

const files = SRC_ROOTS.flatMap((r) => walk(r));
const moduleCss = files.filter((f) => f.endsWith(".module.css"));
const globalCss = files.filter((f) => f.endsWith(".css") && !f.endsWith(".module.css"));

// Global <prefix>-* class + keyframe names a module is allowed to compose.
const globalUtils = new Set();
for (const f of globalCss) {
  const css = readFileSync(f, "utf8");
  for (const m of css.matchAll(new RegExp(`\\.(${kf}-[\\w-]+)\\b`, "g"))) globalUtils.add(m[1]);
  for (const m of css.matchAll(new RegExp(`@keyframes\\s+(${kf}-[\\w-]+)`, "g"))) globalUtils.add(m[1]);
}

const violations = [];
for (const f of moduleCss) {
  const rel = relative(REPO, f);
  const css = blankComments(readFileSync(f, "utf8"));
  for (const m of css.matchAll(/(?:^|[\s;{])(animation(?:-name)?)\s*:\s*([^;{}]*)/g)) {
    const value = m[2];
    const hit = value.match(new RegExp(`\\b${kf}-[\\w-]+`));
    if (hit && !new RegExp(`var\\(\\s*--[^)]*${kf}-`).test(value)) {
      violations.push({ file: rel, line: lineAt(css, m.index), kind: "inline-animation",
        detail: `\`${m[1]}: …${hit[0]}…\` names a ${PREFIX}-* keyframe inside a CSS module — Vite scopes it to a dead name. Use \`composes: ${hit[0]} from global\` instead.` });
    }
  }
  for (const m of css.matchAll(/composes\s*:\s*([^;{}]+?)\s+from\s+global/g)) {
    for (const n of m[1].split(/\s+/).filter(Boolean)) {
      if (n.startsWith(PREFIX + "-") && !globalUtils.has(n)) {
        violations.push({ file: rel, line: lineAt(css, m.index), kind: "dangling-composes",
          detail: `composes \`${n} from global\` but no global \`.${n}\` class / \`@keyframes ${n}\` exists — the motion will silently no-op.` });
      }
    }
  }
}

if (violations.length) {
  console.error(`\ncheck-motion: ${violations.length} keyframe-scoping violation(s):\n`);
  for (const v of violations) console.error(`  ✖ ${v.file}:${v.line} [${v.kind}]\n      ${v.detail}`);
  console.error(`\nFix: define motion once globally (a \`.${PREFIX}-NAME\` utility / \`@keyframes ${PREFIX}-NAME\`) and consume it via \`composes: ${PREFIX}-NAME from global\`.\n`);
  process.exit(STRICT ? 1 : 0);
}
console.log(`check-motion: OK — ${moduleCss.length} module(s) across ${SRC_ROOTS.length} src root(s) vs ${globalUtils.size} global ${PREFIX}-* utilities, 0 violations.`);
