#!/usr/bin/env node
// check-ds-drift.mjs — surface GENUINE design-system prop-contract drift, not styling noise.
//
// The app re-authors every upstream primitive from inline-style .jsx into CSS-modules, so the
// .jsx ALWAYS diff hugely — that is not a real change signal. The medium-neutral signal is the
// `.d.ts` prop contract. This gate compares each app `<Name>.d.ts` props interface against the
// committed upstream baseline, IGNORING doc comments + quote style, and suppresses INTENTIONAL
// local divergence recorded in `.design-sync.json` -> projects.<ds>.localPatches. What's left is
// the real signal: props the app is missing from upstream (a miss), or types that diverged
// without being registered as deliberate.
//
// Usage: node scripts/check-ds-drift.mjs           (report; exit 0)
//        node scripts/check-ds-drift.mjs --strict   (exit 1 if any UNREGISTERED drift)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, basename, resolve } from "node:path";

// Repo-agnostic: find the target repo by its .design-sync.json (walk up from cwd) or take --repo.
const argFlag = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
function findRepo(start) {
  let d = resolve(start);
  for (;;) { if (existsSync(join(d, ".design-sync.json"))) return d; const p = dirname(d); if (p === d) return null; d = p; }
}
const ROOT = argFlag("--repo", findRepo(process.cwd()) || process.cwd());
const STRICT = process.argv.includes("--strict");

const cfg = JSON.parse(readFileSync(join(ROOT, ".design-sync.json"), "utf8"));
// Pick the design-system project (the one whose baseline holds the DS `components/` tree).
const dsEntry = Object.entries(cfg.projects).find(
  ([, p]) => (p.kind || "").includes("design-system") || existsSync(join(ROOT, p.baseline || "", "components"))
);
if (!dsEntry) {
  console.error("check-ds-drift: no design-system project with a components/ baseline found in .design-sync.json");
  process.exit(2);
}
const [dsName, ds] = dsEntry;
const baseDir = join(ROOT, ds.baseline, "components");
const appDir = join(ROOT, ds.primitives);
const patches = ds.localPatches || {};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
const byName = (paths) => new Map(paths.map((p) => [basename(p, ".d.ts"), p]));
const baseFiles = byName(walk(baseDir));
const appFiles = byName(walk(appDir));

// --- lightweight .d.ts props-interface parser (these contracts are flat + simple) ---
function extractProps(src) {
  const m = src.match(/export\s+interface\s+(\w*Props)\b([^{]*)\{/);
  if (!m) return null;
  const extendsClause = ((m[2].match(/extends\s+([^{]+)/) || [, ""])[1] || "").replace(/\s+/g, " ").trim();
  let depth = 0,
    body = "",
    started = false;
  for (let i = src.indexOf("{", m.index); i < src.length; i++) {
    const c = src[i];
    if (c === "{") {
      depth++;
      if (depth === 1) {
        started = true;
        continue;
      }
    }
    if (c === "}") {
      depth--;
      if (depth === 0) break;
    }
    if (started) body += c;
  }
  return { extendsClause, members: parseMembers(body) };
}
function parseMembers(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const members = {};
  for (let chunk of clean.split(";")) {
    chunk = chunk.trim();
    if (!chunk) continue;
    const mm = chunk.match(/^(\w+)(\?)?\s*:\s*([\s\S]+)$/);
    if (!mm) continue;
    members[mm[1]] = { optional: !!mm[2], type: normType(mm[3]) };
  }
  return members;
}
function normType(t) {
  t = t.replace(/\s+/g, " ").trim().replace(/'/g, '"').replace(/;$/, "");
  if (t.includes("|")) return t.split("|").map((s) => s.trim()).filter(Boolean).sort().join(" | ");
  return t;
}

const isRegistered = (comp, kind, prop) => ((patches[comp] && patches[comp][kind]) || []).includes(prop);
const report = []; // {comp, severity, kind, detail}
let realDrift = 0;

// Components present upstream
for (const [comp, basePath] of baseFiles) {
  const baseP = extractProps(readFileSync(basePath, "utf8"));
  const appPath = appFiles.get(comp);
  if (!appPath) {
    report.push({ comp, severity: "MISS", kind: "missing-component", detail: `upstream ships ${comp} but the app has no ${comp}.d.ts — port it.` });
    realDrift++;
    continue;
  }
  const appP = extractProps(readFileSync(appPath, "utf8"));
  if (!baseP || !appP) continue;

  for (const [prop, b] of Object.entries(baseP.members)) {
    const a = appP.members[prop];
    if (!a) {
      if (isRegistered(comp, "dropped", prop)) continue;
      report.push({ comp, severity: "MISS", kind: "missing-prop", detail: `upstream has \`${prop}${b.optional ? "?" : ""}: ${b.type}\` — app is missing it.` });
      realDrift++;
    } else if (a.type !== b.type || a.optional !== b.optional) {
      if (isRegistered(comp, "retyped", prop)) continue;
      report.push({
        comp,
        severity: "DRIFT",
        kind: "retyped",
        detail: `\`${prop}\`: upstream \`${b.optional ? "?" : ""}: ${b.type}\`  vs  app \`${a.optional ? "?" : ""}: ${a.type}\``,
      });
      realDrift++;
    }
  }
  for (const prop of Object.keys(appP.members)) {
    if (baseP.members[prop]) continue;
    if (isRegistered(comp, "added", prop)) continue;
    report.push({ comp, severity: "LOCAL?", kind: "app-only-prop", detail: `app has \`${prop}\` not in upstream — register it under localPatches.${comp}.added or remove it.` });
    realDrift++;
  }
  if (baseP.extendsClause !== appP.extendsClause && !isRegistered(comp, "retyped", "extends")) {
    report.push({ comp, severity: "DRIFT", kind: "extends", detail: `interface extends differs: upstream \`${baseP.extendsClause || "—"}\` vs app \`${appP.extendsClause || "—"}\`` });
    realDrift++;
  }
}

console.log(`check-ds-drift: ${dsName}  (baseline: ${relative(ROOT, baseDir)})`);
const patchCount = Object.keys(patches).filter((k) => !k.startsWith("$")).length;
console.log(`  ${baseFiles.size} upstream contracts vs ${appFiles.size} app contracts; ${patchCount} registered local-patch component(s).\n`);
if (!report.length) {
  console.log("  ✓ no unregistered prop-contract drift — every divergence is doc-only or a registered local patch.");
  process.exit(0);
}
for (const r of report) console.log(`  ${r.severity === "MISS" ? "✖" : "•"} [${r.severity}] ${r.comp}: ${r.detail}`);
console.log(`\n  ${realDrift} unregistered divergence(s). MISS = behind upstream (act). DRIFT/LOCAL? = decide, then register in .design-sync.json localPatches if intentional.`);
process.exit(STRICT ? 1 : 0);
