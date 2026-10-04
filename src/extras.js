// Grammar libraries. They run in the browser, so they live here and not in engine.js.
// Every function returns plain issues ({ rule, category, start, end, text, message, fixes })
// that engine.check() merges with its own. All of it runs on this page; nothing is sent anywhere.
//
//   retext-*   small rule packs: a/an, missing apostrophes, insensitive wording
//   compromise lower-case names and places (checked against the spelling dictionary first)
//   Harper     a rules-based grammar checker (WebAssembly, no AI): commas, capitals, agreement

import { unified } from 'unified';
import retextEnglish from 'retext-english';
import retextIndefiniteArticle from 'retext-indefinite-article';
import retextContractions from 'retext-contractions';
import retextEquality from 'retext-equality';
import { VFile } from 'vfile';
import nlp from 'compromise';
import { createBinaryModuleFromUrl, LocalLinter, Dialect } from 'harper.js';

// ───────────────────────────── retext ─────────────────────────────

const processor = unified()
  .use(retextEnglish)
  .use(retextIndefiniteArticle)
  .use(retextContractions, { straight: true })
  .use(retextEquality);

// Equality rules that fire on ordinary customer email ("he said", "she called")
const EQUALITY_SKIP = new Set(['he-she', 'her-him', 'his-hers', 'himself-herself', 'hero-heroine', 'boy-girl', 'man-woman']);

function retextIssues(text) {
  const file = new VFile(text);
  processor.runSync(processor.parse(file), file);
  const out = [];
  for (const m of file.messages) {
    const start = m.place?.start?.offset, end = m.place?.end?.offset;
    if (start == null || end == null || end <= start) continue;
    const word = text.slice(start, end);
    const expected = (m.expected || []).slice(0, 3);
    if (m.source === 'retext-equality') {
      if (EQUALITY_SKIP.has(m.ruleId)) continue;
      out.push({
        rule: `inclusive:${m.ruleId}`, category: 'inclusive', start, end, text: word,
        message: `“${word}” can come across as insensitive. ${expected.length ? 'Consider ' + expected.map((e) => `“${e}”`).join(', ') + '.' : ''}`.trim(),
        fixes: expected.map((e) => ({ label: `Change to “${e}”`, start, end, replacement: matchCase(word, e) })),
      });
    } else if (m.source === 'retext-indefinite-article') {
      out.push({
        rule: 'grammar:article', category: 'grammar', start, end, text: word,
        message: m.reason.replace(/`([^`]*)`/g, '“$1”').replace(/^Unexpected article/, 'Wrong article'),
        fixes: expected.map((e) => ({ label: `Change to “${e}”`, start, end, replacement: matchCase(word, e) })),
      });
    } else if (m.source === 'retext-contractions') {
      out.push({
        rule: 'grammar:apostrophe', category: 'grammar', start, end, text: word,
        message: `Missing apostrophe in “${word}”.`,
        fixes: expected.map((e) => ({ label: `Change to “${e}”`, start, end, replacement: matchCase(word, e) })),
      });
    }
  }
  return out;
}

function matchCase(original, word) {
  return /^\p{Lu}/u.test(original) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

// ───────────────────────────── compromise ─────────────────────────────

// Lower-case people and places. A word the dictionary accepts in lower case ("will", "bill")
// is skipped: it is more likely an ordinary word than a name.
function nameIssues(text, checker) {
  const out = [];
  let terms = [];
  try { terms = nlp(text).match('(#Person|#Place)').terms().json({ offset: true }); } catch { return out; }
  for (const t of terms) {
    const o = t.terms?.[0]?.offset || t.offset;
    if (!o) continue;
    const word = text.slice(o.start, o.start + o.length).replace(/[^\p{L}'’-]+$/u, '');
    if (word.length < 3 || !/^\p{Ll}[\p{Ll}'’-]*$/u.test(word)) continue;
    if (checker && checker.correct(word)) continue;
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    out.push({
      rule: 'capital:guess', category: 'capital', start: o.start, end: o.start + word.length, text: word,
      message: 'This looks like a name or a place. Names take a capital.',
      fixes: [{ label: `Change to “${cap}”`, start: o.start, end: o.start + word.length, replacement: cap }],
    });
  }
  return out;
}

export function libraryIssues(text, { checker = null } = {}) {
  if (!text.trim()) return [];
  let out = [];
  try { out = out.concat(retextIssues(text)); } catch { /* a library failing must never break checking */ }
  try { out = out.concat(nameIssues(text, checker)); } catch { /* same */ }
  return out;
}

// ───────────────────────────── Harper ─────────────────────────────

// Harper's own spelling and style checks are skipped: the NZ English dictionary and the
// rules in rules.js already cover them.
const HARPER_SKIP = new Set(['Spelling', 'Typo', 'Repetition', 'Readability', 'Style', 'Redundancy', 'Formatting']);
const HARPER_CATEGORY = { Capitalization: 'capital', Punctuation: 'punctuation' };

let linter = null;
let loading = null;

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

// `packed` is the Harper WebAssembly file, gzipped and written as base64 by build.mjs.
export function loadHarper(packed) {
  if (linter) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    if (!packed || packed.length < 1000 || typeof DecompressionStream === 'undefined') return false;
    const raw = Uint8Array.from(atob(packed.trim()), (c) => c.charCodeAt(0));
    const wasm = await gunzip(raw);
    const url = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    const l = new LocalLinter({ binary: createBinaryModuleFromUrl(url, 'full'), dialect: Dialect.British });
    await l.setup();
    URL.revokeObjectURL(url);
    linter = l;
    return true;
  })().catch(() => false);
  return loading;
}

export const harperReady = () => !!linter;

// Harper counts characters as code points; the page counts UTF-16 units. They differ after an emoji.
function toUtf16(text) {
  if (!/[\ud800-\udfff]/.test(text)) return (i) => i;
  const map = [];
  let u = 0;
  for (const ch of text) { map.push(u); u += ch.length; }
  map.push(u);
  return (i) => map[Math.min(i, map.length - 1)];
}

export async function harperIssues(text) {
  if (!linter || !text.trim()) return [];
  const byRule = await linter.organizedLints(text);
  const at = toUtf16(text);
  const out = [];
  for (const [ruleName, lints] of Object.entries(byRule)) {
    for (const lint of lints) {
      const kind = lint.lint_kind();
      if (HARPER_SKIP.has(kind)) continue;
      const span = lint.span();
      const start = at(span.start), end = at(span.end);
      if (end < start) continue;
      const fixes = lint.suggestions().slice(0, 3).map((s) => {
        const rep = s.get_replacement_text();
        const k = s.kind();
        if (k === 1) return { label: 'Remove', start, end, replacement: '' };
        if (k === 2) return { label: `Add “${rep}”`, start: end, end, replacement: rep };
        return { label: `Change to “${rep}”`, start, end, replacement: rep };
      });
      out.push({
        rule: `harper:${ruleName}`, category: HARPER_CATEGORY[kind] || 'grammar', start, end,
        text: text.slice(start, end) || text.slice(Math.max(0, start - 12), end),
        message: lint.message().replace(/`([^`]*)`/g, '“$1”'), fixes,
      });
      lint.free?.();
    }
  }
  return out;
}

// While you type, the last Harper results stay on screen. Keep the ones that sit outside the
// edit and move the ones after it, so cards do not vanish until the new results arrive.
export function carryOver(oldText, newText, issues) {
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let s = 0;
  while (s < max - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
  const delta = newText.length - oldText.length;
  const out = [];
  for (const i of issues) {
    if (i.end <= p) out.push(i);
    else if (i.start >= oldText.length - s) {
      const shift = (n) => n + delta;
      out.push({ ...i, start: shift(i.start), end: shift(i.end), fixes: i.fixes.map((f) => ({ ...f, start: shift(f.start), end: shift(f.end) })) });
    }
  }
  return out;
}
