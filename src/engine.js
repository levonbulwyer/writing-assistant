// The checking engine. Pure functions only: text in, results out.
// Nothing here touches the page, storage or the network, so it can be tested with `npm test`.

import {
  FILLER, WORDY, AVOID_DEFAULT, REPEAT_STOPWORDS, ACRONYMS, NOT_PASSIVE,
  IRREGULAR_PARTICIPLES, NZ_WORDS,
} from './rules.js';

export const DEFAULT_SETTINGS = {
  quotes: 'curly',      // 'curly' | 'straight' | 'keep'
  dashes: 'en',         // 'en' (spaced –) | 'em' (—) | 'keep'
  bullets: '•',         // '•' | '–' | '-'
  longSentence: 25,
  checks: {
    spelling: true, filler: true, wordy: true, avoid: true, passive: true,
    long: true, repeat: true, shouty: true, placeholder: true,
  },
  checkCapitalised: false,
  clean: null,          // filled from DEFAULT_CLEAN; each Clean step can be switched off
  cleanOnPaste: false,
  disabledRules: [],
  avoid: AVOID_DEFAULT,
};

export const CATEGORIES = {
  spelling:    { name: 'Spelling',        tone: 'red' },
  placeholder: { name: 'Fill in',         tone: 'purple' },
  shouty:      { name: 'Shouting',        tone: 'orange' },
  avoid:       { name: 'Your list',       tone: 'orange' },
  repeat:      { name: 'Repeated word',   tone: 'orange' },
  wordy:       { name: 'Wordy',           tone: 'blue' },
  filler:      { name: 'Filler word',     tone: 'blue' },
  passive:     { name: 'Passive voice',   tone: 'blue' },
  long:        { name: 'Long sentence',   tone: 'yellow' },
};

const L = '\\p{L}\\p{M}';
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'approx', 'incl', 'vs', 'no', 'cf', 'ca', 'mr', 'mrs', 'ms', 'dr', 'st', 'ltd', 'co', 'ph', 'tel', 'attn', 'ref', 'nb', 'p', 'pp', 'eg', 'ie', 'a.m', 'p.m', 'am', 'pm', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec']);
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MONTHS = ['january', 'february', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches a phrase as whole words. Group 1 is the character before it (no lookbehind,
// so the file still runs in older browsers); the phrase itself is group 2.
function phraseRegex(phrase) {
  const body = phrase.split(/\s+/).map(escapeRegex).join('\\s+');
  return new RegExp(`(^|[^${L}'’])(${body})(?![${L}'’])`, 'giu');
}

function phraseMatches(text, re) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    out.push({ start, end: start + m[2].length, text: m[2] });
    re.lastIndex = start + Math.max(1, m[2].length);
  }
  return out;
}

function findLast(list, fn) {
  for (let i = list.length - 1; i >= 0; i--) if (fn(list[i], i)) return i;
  return -1;
}

function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function matchCase(original, replacement) {
  if (!replacement) return replacement;
  const first = original.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) return capFirst(replacement);
  return replacement;
}

// ───────────────────────────── Tokenising ─────────────────────────────

const WORD_RE = new RegExp(`[${L}](?:[${L}'’-]*[${L}])?`, 'gu');

export function words(text) {
  const out = [];
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(text))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

function wordBefore(text, idx) {
  // The word (letters and dots) that ends right before idx.
  let i = idx;
  while (i > 0 && /[\p{L}.]/u.test(text[i - 1])) i--;
  return text.slice(i, idx).toLowerCase().replace(/\.$/, '');
}

export function sentences(text) {
  const out = [];
  let start = 0;
  const push = (end) => {
    let s = start;
    while (s < end && /\s/.test(text[s])) s++;
    let e = end;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) out.push({ start: s, end: e, text: text.slice(s, e) });
  };
  const re = /[.!?]+["”’)]*(?=\s|$)|\n/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[0] !== '\n' && m[0].startsWith('.') && m[0].length === 1) {
      const w = wordBefore(text, m.index);
      if (ABBREVIATIONS.has(w) || /^\d+$/.test(w)) continue;
    }
    const end = m.index + m[0].length;
    push(end);
    start = end;
  }
  push(text.length);
  return out;
}

function isSentenceStart(text, idx) {
  let i = idx - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t' || text[i] === '"' || text[i] === '“' || text[i] === '(' || text[i] === '‘')) i--;
  if (i < 0) return true;
  if (text[i] === '\n') return true;
  if (/[!?]/.test(text[i])) return true;
  if (text[i] === '.' || text[i] === '”' || text[i] === '’' || text[i] === ')') {
    if (text[i] === '.') {
      const w = wordBefore(text, i);
      if (ABBREVIATIONS.has(w)) return false;
    }
    return true;
  }
  if (text[i] === '•' || text[i] === '–' || text[i] === '-') {
    // bullet at the start of a line
    let j = i - 1;
    while (j >= 0 && text[j] === ' ') j--;
    return j < 0 || text[j] === '\n';
  }
  return false;
}

// ───────────────────────────── Auto-clean ─────────────────────────────

// Each part of Clean can be switched off in Settings.
export const CLEAN_STEPS = [
  { key: 'spaces', name: 'Extra spaces', sub: 'Double spaces, spaces at line ends, space before a comma' },
  { key: 'punctuation', name: 'Missing spaces and doubled marks', sub: '“Hi,thanks” → “Hi, thanks”, “,,” → “,”' },
  { key: 'lineBreaks', name: 'Broken lines', sub: 'Rejoins lines split by pasting from email or PDF' },
  { key: 'blankLines', name: 'Extra blank lines', sub: 'Keeps one blank line between paragraphs' },
  { key: 'apostrophes', name: 'Missing apostrophes', sub: '“dont” → “don’t”, “im” → “I’m”' },
  { key: 'bullets', name: 'Bullets', sub: 'One bullet style' },
  { key: 'dashes', name: 'Dashes', sub: 'One dash style between words' },
  { key: 'quotes', name: 'Quote marks', sub: 'One quote style' },
  { key: 'capitals', name: 'Capital letters', sub: 'Sentence starts, the word I, days and months' },
];
export const DEFAULT_CLEAN = Object.fromEntries(CLEAN_STEPS.map((s) => [s.key, true]));

const APOSTROPHE_FIXES = {
  dont: "don't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", arent: "aren't", wasnt: "wasn't",
  werent: "weren't", cant: "can't", couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't",
  wont: "won't", havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", mustnt: "mustn't", neednt: "needn't",
  im: "I'm", ive: "I've", youre: "you're", youve: "you've", youll: "you'll", youd: "you'd",
  theyre: "they're", theyve: "they've", theyll: "they'll", weve: "we've", shes: "she's", hes: "he's",
  thats: "that's", whats: "what's", wheres: "where's", theres: "there's", heres: "here's", whos: "who's",
};

// Links, email addresses and {{blanks}} are swapped for markers so Clean never changes them.
const PROTECT_RE = /\{\{[^{}\n]*\}\}|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|https?:\/\/\S+|www\.\S+/g;
function protect(text) {
  const kept = [];
  const masked = text.replace(PROTECT_RE, (m) => {
    const trail = m.match(/[.,;:!?)]+$/);
    const core = trail && !m.startsWith('{{') ? m.slice(0, -trail[0].length) : m;
    kept.push(core);
    return `${kept.length - 1}` + (core.length < m.length ? m.slice(core.length) : '');
  });
  return { masked, restore: (t) => t.replace(/(\d+)/g, (m, i) => kept[Number(i)]) };
}

export function clean(input, settings = DEFAULT_SETTINGS) {
  const on = { ...DEFAULT_CLEAN, ...(settings.clean || {}) };
  const counts = {};
  const bump = (k, n) => { if (n) counts[k] = (counts[k] || 0) + n; };
  const { masked, restore } = protect(input.replace(/\r\n?/g, '\n').replace(/ /g, ' '));
  let t = masked;
  const count = (re) => (t.match(re) || []).length;

  if (on.spaces) {
    bump('spaces', count(/[ \t]+$/gm));
    t = t.replace(/[ \t]+$/gm, '');
    bump('spaces', count(/^ +(?=\S)/gm));
    t = t.replace(/^ +(?=\S)/gm, '');
    bump('spaces', count(/(\S) {2,}/g));
    t = t.replace(/(\S) {2,}/g, '$1 ');
    bump('spaces', count(/(\S) +([,;:!?]|\.(?!\.))(?=\s|$)/g));
    t = t.replace(/(\S) +([,;:!?]|\.(?!\.))(?=\s|$)/g, '$1$2');
  }

  if (on.apostrophes) {
    const re = new RegExp(`\\b(${Object.keys(APOSTROPHE_FIXES).join('|')})\\b`, 'gi');
    t = t.replace(re, (m) => {
      if (m === m.toUpperCase() && m.length > 2) return m; // CANT in capitals: leave for the shouting rule
      bump('apostrophes', 1);
      let fix = APOSTROPHE_FIXES[m.toLowerCase()];
      if (on.quotes && settings.quotes === 'curly') fix = fix.replace("'", '’');
      return /^I['’]/.test(fix) ? fix : (/^\p{Lu}/u.test(m) ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix);
    });
  }

  if (on.punctuation) {
    // Doubled marks (an ellipsis "..." is left alone)
    t = t.replace(/,{2,}/g, () => { bump('punctuation', 1); return ','; });
    t = t.replace(/([^.])\.\.(?!\.)/g, (m, p) => { bump('punctuation', 1); return p + '.'; });
    t = t.replace(/\?{2,}/g, () => { bump('punctuation', 1); return '?'; });
    // Missing space after a comma, or after a full stop that ends a sentence
    t = t.replace(/,(?=\p{L})/gu, () => { bump('punctuation', 1); return ', '; });
    t = t.replace(/(\p{Ll}{2,})([.?!])(\p{Lu})(?=\p{Ll}|['’]\p{Ll}|\s)/gu, (m, w, p, n) => {
      if (ABBREVIATIONS.has(w.toLowerCase())) return m;
      bump('punctuation', 1);
      return `${w}${p} ${n}`;
    });
  }

  if (on.lineBreaks) {
    // Rejoin lines broken by pasting. A line is only joined to the next when it is close to the
    // longest line in its block, so short lines (a list without bullets) stay as they are.
    const lines = t.split('\n');
    const isBullet = (s) => /^\s*([*•·◦‣▪●–-]\s|\d+[.)]\s)/.test(s);
    const blockMax = new Array(lines.length).fill(0);
    for (let i = 0; i < lines.length;) {
      let j = i;
      while (j < lines.length && lines[j].trim() !== '') j++;
      const max = Math.max(0, ...lines.slice(i, j).map((l) => l.length));
      for (let k = i; k < j; k++) blockMax[k] = max;
      i = j + 1;
    }
    const merged = [];
    let joins = 0;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const wrapAt = blockMax[i];
      while (
        i + 1 < lines.length &&
        line.trim() !== '' &&
        lines[i + 1].trim() !== '' &&
        !isBullet(lines[i + 1]) &&
        !/[.!?:;,]["”’)]?$/.test(line) &&
        /^[a-z(]/.test(lines[i + 1]) &&
        lines[i].length >= 30 &&
        lines[i].length >= wrapAt * 0.7
      ) {
        if (/[a-z]-$/.test(line)) line = line.slice(0, -1) + lines[i + 1];
        else line = line + ' ' + lines[i + 1];
        i++;
        joins++;
      }
      merged.push(line);
    }
    bump('lineBreaks', joins);
    t = merged.join('\n');
  }

  if (on.blankLines) {
    bump('blankLines', count(/\n{3,}/g));
    t = t.replace(/\n{3,}/g, '\n\n');
  }

  if (on.bullets) {
    const b = settings.bullets || '•';
    t = t.replace(/^([*•·◦‣▪●–]|-)[ \t]+/gm, (m, mark) => {
      if (mark !== b) bump('bullets', 1);
      return b + ' ';
    });
  }

  if (on.dashes && settings.dashes !== 'keep') {
    const dash = settings.dashes === 'em' ? '—' : ' – ';
    const swap = (m, pre) => {
      const out = pre + dash;
      if (m !== out) bump('dashes', 1);
      return out;
    };
    t = t.replace(/(\S)[ \t]+(?:-{1,3}|–|—)[ \t]+(?=\S)/g, swap);
    t = t.replace(/([\p{L}\d])(?:-{2,3}|—)(?=[\p{L}\d])/gu, swap);
  }

  if (on.quotes && settings.quotes === 'curly') {
    t = t.replace(/(^|[\s([{—–])"/gm, (m, p) => { bump('quotes', 1); return p + '“'; });
    t = t.replace(/"/g, () => { bump('quotes', 1); return '”'; });
    t = t.replace(/([\p{L}\d])'/gu, (m, p) => { bump('quotes', 1); return p + '’'; });
    t = t.replace(/(^|[\s([{—–“])'/gm, (m, p) => { bump('quotes', 1); return p + '‘'; });
    t = t.replace(/'/g, () => { bump('quotes', 1); return '’'; });
  } else if (on.quotes && settings.quotes === 'straight') {
    t = t.replace(/[“”„]/g, () => { bump('quotes', 1); return '"'; });
    t = t.replace(/[‘’]/g, () => { bump('quotes', 1); return "'"; });
  }

  if (on.capitals) {
    // The word I on its own
    t = t.replace(/(^|[\s(“"‘'])i(?=['’](?:m|ve|ll|d)\b|[\s,!?;:)]|\.(?!e\.)|$)/gm, (m, p) => { bump('capitals', 1); return p + 'I'; });
    // Day and month names (not "may" or "march", which are also ordinary words)
    const dm = new RegExp(`\\b(${DAYS.concat(MONTHS).join('|')})\\b`, 'g');
    t = t.replace(dm, (m) => { bump('capitals', 1); return capFirst(m); });
    // First letter of each line
    t = t.replace(/^((?:[•–-]\s+)?[“"‘'(]?)([a-z])(\S*)/gm, (m, pre, ch, rest) => {
      if (/[@/.\d:]/.test(rest) || /^(www|http)/i.test(ch + rest)) return m;
      bump('capitals', 1);
      return pre + ch.toUpperCase() + rest;
    });
    // First letter after a full stop, question mark or exclamation mark
    t = t.replace(/([.!?])(["”’)]?[ \t]+)([a-z])/g, (m, end, gap, ch, offset) => {
      if (end === '.') {
        if (t[offset - 1] === '.') return m; // an ellipsis does not end a sentence
        const w = wordBefore(t, offset);
        if (ABBREVIATIONS.has(w)) return m;
      }
      bump('capitals', 1);
      return end + gap + ch.toUpperCase();
    });
  }

  t = t.replace(/^\n+/, '').replace(/\s+$/, '');
  return { text: restore(t), counts };
}

export function describeClean(counts) {
  const names = {
    spaces: ['extra space', 'extra spaces'],
    punctuation: ['spacing or punctuation fix', 'spacing or punctuation fixes'],
    lineBreaks: ['broken line rejoined', 'broken lines rejoined'],
    blankLines: ['run of blank lines', 'runs of blank lines'],
    apostrophes: ['missing apostrophe', 'missing apostrophes'],
    bullets: ['bullet', 'bullets'],
    dashes: ['dash', 'dashes'],
    quotes: ['quote mark', 'quote marks'],
    capitals: ['capital letter', 'capital letters'],
  };
  const parts = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${n} ${names[k][n === 1 ? 0 : 1]}`);
  return parts.length ? 'Fixed ' + parts.join(', ') : 'Nothing to clean';
}

// ───────────────────────────── Rules ─────────────────────────────

function deleteFix(text, start, end) {
  // Remove [start, end) plus one neighbouring space, and fix the capital letter if the
  // removed words began a sentence.
  let s = start, e = end;
  if (text[e] === ',' ) e++;
  if (text[e] === ' ') e++;
  else if (s > 0 && text[s - 1] === ' ') s--;
  let replacement = '';
  if (isSentenceStart(text, start)) {
    const next = text.slice(e).match(/^[\p{L}]/u);
    if (next) { replacement = next[0].toUpperCase(); e += next[0].length; }
  }
  return { start: s, end: e, replacement };
}

function phraseIssues(text, list, category, makeMessage) {
  const out = [];
  for (const item of list) {
    const [phrase, swap, note] = Array.isArray(item) ? item : [item.phrase, item.swap, item.why];
    if (!phrase || !phrase.trim()) continue;
    for (const m of phraseMatches(text, phraseRegex(phrase.trim()))) {
      const { start, end } = m;
      const issue = {
        rule: `${category}:${phrase.toLowerCase()}`,
        category, start, end, text: m.text,
        message: makeMessage(phrase, swap, note),
        fixes: [],
      };
      if (swap === '') issue.fixes.push({ label: 'Remove', ...deleteFix(text, start, end) });
      else if (typeof swap === 'string') issue.fixes.push({ label: `Change to “${matchCase(m.text, swap)}”`, start, end, replacement: matchCase(m.text, swap) });
      out.push(issue);
    }
  }
  return out;
}

function dropContained(issues) {
  // Within the phrase rules, keep the longer match when one sits inside another.
  return issues.filter((a) => !issues.some((b) => b !== a && b.start <= a.start && b.end >= a.end && (b.end - b.start) > (a.end - a.start)));
}

function passiveIssues(text) {
  const out = [];
  const re = new RegExp(`\\b(am|is|are|was|were|be|been|being|get|gets|got|getting|gotten)\\s+(?:(\\w+ly)\\s+)?(\\w+ed|${IRREGULAR_PARTICIPLES.join('|')})\\b`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const participle = m[3].toLowerCase();
    if (NOT_PASSIVE.has(participle)) continue;
    if (/^(need|feed|seed|speed|bleed|breed|weed|indeed|exceed|proceed|succeed|bed|red|shed|wed|led|fed)$/.test(participle)) continue;
    out.push({
      rule: 'passive', category: 'passive', start: m.index, end: m.index + m[0].length, text: m[0],
      message: 'Possible passive voice. Say who did it: “We sent the form” reads better than “The form was sent”.',
      fixes: [],
    });
  }
  return out;
}

function longSentenceIssues(text, limit) {
  const out = [];
  for (const s of sentences(text)) {
    const n = words(s.text).length;
    if (n > limit) {
      out.push({
        rule: 'long', category: 'long', start: s.start, end: s.end, text: s.text,
        message: `This sentence has ${n} words. Aim for ${limit} or fewer. Split it where the idea changes.`,
        fixes: [], words: n,
      });
    }
  }
  return out;
}

function repeatIssues(text) {
  const out = [];
  const ws = words(text);
  for (let i = 1; i < ws.length; i++) {
    const w = ws[i], lw = w.text.toLowerCase();
    const prev = ws[i - 1];
    const between = text.slice(prev.end, w.start);
    if (prev.text.toLowerCase() === lw && /^[ \t]+$/.test(between)) {
      out.push({
        rule: 'repeat:double', category: 'repeat', start: w.start, end: w.end, text: w.text,
        message: `“${w.text}” appears twice in a row.`,
        fixes: [{ label: 'Remove the second one', start: prev.end, end: w.end, replacement: '' }],
      });
      continue;
    }
    if (REPEAT_STOPWORDS.has(lw) || lw.length < 3) continue;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      if (ws[j].text.toLowerCase() === lw) {
        if (/\n\s*\n/.test(text.slice(ws[j].end, w.start))) break;
        out.push({
          rule: 'repeat:near', category: 'repeat', start: w.start, end: w.end, text: w.text,
          message: `“${w.text}” is used twice within a few words. Try another word or rephrase.`,
          fixes: [],
        });
        break;
      }
    }
  }
  return out;
}

function shoutyIssues(text) {
  const out = [];
  let m;
  const multi = /!{2,}/g;
  while ((m = multi.exec(text))) {
    out.push({
      rule: 'shouty:multi', category: 'shouty', start: m.index, end: m.index + m[0].length, text: m[0],
      message: 'More than one exclamation mark reads as shouting.',
      fixes: [{ label: 'Change to “.”', start: m.index, end: m.index + m[0].length, replacement: '.' }],
    });
  }
  const singles = [];
  for (let i = 0; i < text.length; i++) if (text[i] === '!' && text[i - 1] !== '!' && text[i + 1] !== '!') singles.push(i);
  singles.slice(1).forEach((i) => {
    out.push({
      rule: 'shouty:exclaim', category: 'shouty', start: i, end: i + 1, text: '!',
      message: 'One exclamation mark per message is plenty in work email.',
      fixes: [{ label: 'Change to “.”', start: i, end: i + 1, replacement: '.' }],
    });
  });
  const caps = /\b[A-Z][A-Z']{1,}\b/g;
  while ((m = caps.exec(text))) {
    const w = m[0];
    if (ACRONYMS.has(w)) continue;
    if (w.length < 4) continue;
    out.push({
      rule: 'shouty:caps', category: 'shouty', start: m.index, end: m.index + w.length, text: w,
      message: 'Words in capitals read as shouting. Use bold or a short sentence for emphasis instead.',
      fixes: [{ label: `Change to “${w.toLowerCase()}”`, start: m.index, end: m.index + w.length, replacement: w.toLowerCase() }],
    });
  }
  return out;
}

export const PLACEHOLDER_RE = /\{\{([^{}\n]{1,60})\}\}/g;

function placeholderIssues(text) {
  const out = [];
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text))) {
    out.push({
      rule: 'placeholder', category: 'placeholder', start: m.index, end: m.index + m[0].length, text: m[0],
      message: `Fill in ${m[1].trim().toLowerCase()}.`, fixes: [], label: m[1].trim(),
    });
  }
  return out;
}

function protectedRanges(text) {
  const ranges = [];
  const re = /\S+@\S+\.\S+|https?:\/\/\S+|www\.\S+|\{\{[^{}\n]*\}\}/g;
  let m;
  while ((m = re.exec(text))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

const inRanges = (ranges, s, e) => ranges.some(([a, b]) => s < b && e > a);

// Spelling. `checker` is anything with correct(word) → boolean (nspell in the app).
export function spellingIssues(text, checker, settings = DEFAULT_SETTINGS, personal = []) {
  if (!checker) return [];
  const known = new Set(NZ_WORDS.map((w) => w.toLowerCase()).concat(personal.map((w) => w.toLowerCase())));
  const prot = protectedRanges(text);
  const cache = new Map();
  const ok = (w) => {
    if (cache.has(w)) return cache.get(w);
    const r = checker.correct(w);
    cache.set(w, r);
    return r;
  };
  const out = [];
  for (const w of words(text)) {
    const raw = w.text;
    if (raw.length < 2 || /\d/.test(raw)) continue;
    if (raw === raw.toUpperCase()) continue; // acronyms
    if (inRanges(prot, w.start, w.end)) continue;
    const word = raw.replace(/’/g, "'");
    if (known.has(word.toLowerCase())) continue;
    const capitalised = /^\p{Lu}/u.test(word);
    if (capitalised && !settings.checkCapitalised && !isSentenceStart(text, w.start)) continue;
    const parts = word.split('-').filter(Boolean);
    const good = parts.every((p) => known.has(p.toLowerCase()) || ok(p) || (capitalised && ok(p.toLowerCase())) || ok(p.replace(/'s$/, '')));
    if (good) continue;
    out.push({
      rule: 'spelling', category: 'spelling', start: w.start, end: w.end, text: raw,
      message: 'Not in the dictionary.', fixes: [], word,
    });
  }
  return out;
}

export function issueKey(issue) {
  return `${issue.rule}|${issue.text.toLowerCase()}`;
}

export function check(text, { settings = DEFAULT_SETTINGS, checker = null, personal = [], ignored = [] } = {}) {
  const on = settings.checks || DEFAULT_SETTINGS.checks;
  let issues = [];
  let phrases = [];
  if (on.filler) phrases = phrases.concat(phraseIssues(text, FILLER.map((p) => [p, '']), 'filler', () => 'Filler word. Remove it, or say something more specific.'));
  if (on.wordy) phrases = phrases.concat(phraseIssues(text, WORDY, 'wordy', (p, swap, note) => note || (swap ? `Wordy. “${swap}” says the same thing.` : 'Adds words without adding meaning.')));
  if (on.avoid) phrases = phrases.concat(phraseIssues(text, settings.avoid || AVOID_DEFAULT, 'avoid', (p, swap, why) => (why || 'On your list of phrases to avoid.') + (swap ? ` Try “${swap}”.` : '')));
  phrases = dropContained(phrases);
  issues = issues.concat(phrases);
  if (on.passive) issues = issues.concat(passiveIssues(text).filter((p) => !phrases.some((q) => p.start < q.end && p.end > q.start)));
  if (on.long) issues = issues.concat(longSentenceIssues(text, settings.longSentence || 25));
  if (on.repeat) issues = issues.concat(repeatIssues(text));
  if (on.shouty) issues = issues.concat(shoutyIssues(text));
  if (on.placeholder) issues = issues.concat(placeholderIssues(text));
  if (on.spelling) issues = issues.concat(spellingIssues(text, checker, settings, personal));

  // Words inside a {{blank}} are never style or spelling problems
  const blanks = [];
  PLACEHOLDER_RE.lastIndex = 0;
  let pm;
  while ((pm = PLACEHOLDER_RE.exec(text))) blanks.push([pm.index, pm.index + pm[0].length]);
  if (blanks.length) issues = issues.filter((i) => i.category === 'placeholder' || i.category === 'long' || !inRanges(blanks, i.start, i.end));

  const disabled = new Set(settings.disabledRules || []);
  const ign = new Set(ignored);
  issues = issues.filter((i) => !disabled.has(i.rule) && !ign.has(issueKey(i)));
  issues.sort((a, b) => a.start - b.start || b.end - a.end);
  issues.forEach((i, n) => { i.id = `i${n}`; });
  return issues;
}

// Apply several fixes at once (from the end backwards so positions stay valid).
export function applyFixes(text, fixes) {
  const sorted = fixes.slice().sort((a, b) => b.start - a.start);
  let out = text, lastStart = Infinity;
  for (const f of sorted) {
    if (f.end > lastStart) continue; // overlapping, skip
    out = out.slice(0, f.start) + f.replacement + out.slice(f.end);
    lastStart = f.start;
  }
  return out;
}

// ───────────────────────────── Highlights ─────────────────────────────

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Turns text + issues into HTML for the highlight layer behind the text box.
export function highlightHtml(text, issues, activeId = null) {
  const bounds = new Set([0, text.length]);
  for (const i of issues) { bounds.add(i.start); bounds.add(i.end); }
  const points = [...bounds].sort((a, b) => a - b);
  let html = '';
  for (let k = 0; k < points.length - 1; k++) {
    const s = points[k], e = points[k + 1];
    if (e <= s) continue;
    const chunk = escapeHtml(text.slice(s, e));
    const covering = issues.filter((i) => i.start <= s && i.end >= e);
    if (!covering.length) { html += chunk; continue; }
    const cats = new Set(covering.map((i) => i.category));
    const cls = [];
    const under = ['spelling', 'shouty', 'avoid', 'repeat', 'wordy', 'filler', 'passive'].find((c) => cats.has(c));
    if (under) cls.push('u-' + under);
    if (cats.has('long')) cls.push('bg-long');
    if (cats.has('placeholder')) cls.push('bg-fill');
    if (cats.has('flash')) cls.push('bg-flash');
    if (activeId && covering.some((i) => i.id === activeId)) cls.push('is-active');
    const top = covering.filter((i) => i.category !== 'long' && i.category !== 'flash').sort((a, b) => (a.end - a.start) - (b.end - b.start))[0] || covering.find((i) => i.category === 'long');
    html += `<span class="${cls.join(' ')}"${top ? ` data-issue="${top.id}"` : ''}>${chunk}</span>`;
  }
  return html + '\n ';
}

// ───────────────────────────── Checklists ─────────────────────────────

const GREETING_RE = /^(hi|hello|hey|dear|kia ora|tēnā koe|tena koe|tēnā koutou|tena koutou|mōrena|morena|good (morning|afternoon|evening)|greetings)\b/i;
// A sign-off is a short line on its own, such as "Kind regards," or "Ngā mihi".
const SIGNOFF_RE = /^(kind regards|regards|best regards|warm regards|many thanks|thanks|thank you|cheers|ngā mihi|nga mihi|ngā mihi nui|nga mihi nui|noho ora mai|nāku noa, nā|naku noa, na|sincerely|yours sincerely|yours faithfully|best wishes|all the best|best)(\s+(again|so much|very much|nui))?\s*[,.!]?$/i;
const DEADLINE_RE = new RegExp([
  `\\b(${DAYS.join('|')}|today|tonight|tomorrow|next week|this week|end of (the )?(day|week|month)|EOD|COB)\\b`,
  '\\b\\d{1,2}(st|nd|rd|th)?\\s+(of\\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b',
  '\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+\\d{1,2}\\b',
  '\\b\\d{1,2}/\\d{1,2}(/\\d{2,4})?\\b',
  '\\bwithin\\s+\\d+\\s+(working\\s+|business\\s+)?(days?|hours?|weeks?)\\b',
  '\\b\\d{1,2}(:\\d{2})?\\s*(am|pm)\\b',
].join('|'), 'i');

function bodyLines(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let a = 0, b = lines.length;
  if (lines.length && GREETING_RE.test(lines[0])) a = 1;
  const signIdx = findLast(lines, (l, i) => i >= a && SIGNOFF_RE.test(l));
  if (signIdx !== -1) b = signIdx;
  return lines.slice(a, b).join('\n');
}

const CHECK_ITEMS = {
  greeting: {
    label: 'Greeting',
    hint: 'Start with “Hi [name],” or “Kia ora [name],”.',
    test: (t) => GREETING_RE.test(t.split('\n').map((l) => l.trim()).find(Boolean) || ''),
  },
  acknowledge: {
    label: 'Acknowledges the problem',
    hint: 'Thank them for raising it, or say sorry once.',
    test: (t) => /\b(thank you for|thanks for|I understand|I'm sorry|I’m sorry|I am sorry|we're sorry|we’re sorry|we are sorry|I apologise|we apologise|apologies|I appreciate|we appreciate|sorry to hear|sorry for)\b/i.test(t),
  },
  done: {
    label: 'Says what was done',
    hint: 'Say what you checked or changed: “I have checked…”, “We have refunded…”.',
    test: (t) => /\b(I|we)(\s+have|'ve|’ve|\s+had)?\s+(now\s+|also\s+)?(checked|reviewed|looked into|investigated|updated|processed|arranged|refunded|credited|escalated|spoken|passed|confirmed|corrected|fixed|resolved|sent|booked|logged|raised|cancelled|changed|added|removed|applied|reset|organised|found)\b/i.test(t) || /\b(has|have) been\s+\w+ed\b/i.test(t),
  },
  next: {
    label: 'Gives the next step',
    hint: 'Say what happens next: “You’ll get…”, “I’ll call you…”.',
    test: (t) => /\b(I will|I'll|I’ll|we will|we'll|we’ll|you will|you'll|you’ll|you can expect|next step|from here|going forward|booked a new)\b/i.test(t),
  },
  ask: {
    label: 'Clear ask',
    hint: 'Say exactly what you need from them, or ask a question.',
    test: (t) => { const b = bodyLines(t); return /\?/.test(b) || /\b(please|could you|can you|would you|let me know|I need|we need|reply|confirm|send)\b/i.test(b); },
  },
  deadline: {
    label: 'Deadline or date',
    hint: 'Give a day or date: “by Friday 10 October”.',
    test: (t) => DEADLINE_RE.test(bodyLines(t) || t),
  },
  signoff: {
    label: 'Sign-off',
    hint: 'End with “Kind regards,” or “Ngā mihi,” and your name.',
    test: (t) => t.split('\n').map((l) => l.trim()).filter(Boolean).slice(-4).some((l) => SIGNOFF_RE.test(l)),
  },
};

export const MESSAGE_TYPES = {
  general: { name: 'General', items: [] },
  email: { name: 'Email', items: ['greeting', 'ask', 'deadline', 'signoff'] },
  complaint: { name: 'Complaint reply', items: ['greeting', 'acknowledge', 'done', 'next', 'deadline', 'signoff'] },
};

export function checklist(text, type) {
  const def = MESSAGE_TYPES[type] || MESSAGE_TYPES.general;
  return def.items.map((id) => ({ id, label: CHECK_ITEMS[id].label, hint: CHECK_ITEMS[id].hint, ok: !!text.trim() && CHECK_ITEMS[id].test(text) }));
}

// ───────────────────────────── Scores ─────────────────────────────

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function readingLabel(score) {
  if (score >= 90) return 'Very easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly hard';
  if (score >= 30) return 'Hard';
  return 'Very hard';
}

export function scores(text) {
  const ws = words(text);
  const ss = sentences(text).filter((s) => words(s.text).length > 0);
  const nWords = ws.length, nSent = ss.length;
  const syl = ws.reduce((a, w) => a + syllables(w.text), 0);
  const avg = nSent ? nWords / nSent : 0;
  const flesch = nWords && nSent ? 206.835 - 1.015 * avg - 84.6 * (syl / nWords) : null;
  let longest = null;
  for (const s of ss) {
    const n = words(s.text).length;
    if (!longest || n > longest.words) longest = { start: s.start, end: s.end, words: n };
  }
  return {
    words: nWords,
    sentences: nSent,
    characters: text.length,
    avgSentence: Math.round(avg * 10) / 10,
    readingEase: flesch === null ? null : Math.round(Math.max(0, Math.min(100, flesch))),
    readingLabel: flesch === null ? '' : readingLabel(flesch),
    readingMinutes: nWords ? Math.max(1, Math.round(nWords / 230)) : 0,
    longest,
  };
}

// ───────────────────────────── Template redaction ─────────────────────────────

const NAME_WORD = "\\p{Lu}[\\p{L}'’-]+";
const GREETING_NAME_RE = new RegExp(
  `^(?:hi|hello|hey|dear|kia ora|tēnā koe|tena koe|mōrena|morena|good (?:morning|afternoon|evening))\\s+((?:(?:Mr|Mrs|Ms|Miss|Dr|Mx)\\.?\\s+)?${NAME_WORD}(?:\\s+${NAME_WORD})?)\\s*[,!.]?\\s*$`, 'iu');
const NOT_NAMES = new Set(['team', 'all', 'there', 'everyone', 'folks', 'guys', 'sir', 'madam', 'whānau', 'whanau', 'koutou']);

// Finds personal details in a message so a template can be saved without them.
export function findPersonalDetails(text) {
  const found = [];
  const add = (kind, label, placeholder, s, e) => found.push({ kind, label, placeholder, start: s, end: e, text: text.slice(s, e) });
  const scan = (re, kind, label, placeholder, check) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (check && !check(m)) continue;
      add(kind, label, placeholder, m.index, m.index + m[0].length);
    }
  };

  scan(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, 'email', 'Email address', '{{Email address}}');
  scan(/\b0(?:800|508|900)[\s-]?\d{3}[\s-]?\d{3,4}\b/g, 'phone', 'Phone number', '{{Phone number}}');
  scan(/(?:\+64[\s-]?|\b0)\(?\d{1,2}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, 'phone', 'Phone number', '{{Phone number}}');
  scan(/(?:NZ)?\$\s?\d[\d,]*(?:\.\d{2})?\b/g, 'amount', 'Amount', '{{Amount}}');
  scan(/\b(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?\b/gi, 'date', 'Date', '{{Date}}');
  scan(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, 'date', 'Date', '{{Date}}');
  scan(/\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Place|Pl|Lane|Ln|Crescent|Cres|Terrace|Tce|Way|Close|Court|Ct|Grove|Parade|Highway|Hwy|Boulevard|Blvd|Square|Quay|Rise|View)\b\.?(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)*/g, 'address', 'Address', '{{Address}}');
  // "invoice INV-2048", "ref: 123456": keep the word, blank the number
  const refWord = /\b(?:ref(?:erence)?|case|ticket|order|account|invoice|policy|claim|job)\s*(?:no\.?|number|#)?\s*:?\s*([A-Z]{0,5}-?\d[\d-]{3,})\b/gi;
  let rm;
  while ((rm = refWord.exec(text))) {
    const s = rm.index + rm[0].lastIndexOf(rm[1]);
    add('reference', 'Reference number', '{{Reference number}}', s, s + rm[1].length);
  }
  scan(/\b[A-Z]{2,5}-?\d{4,}\b|#\d{4,}\b|\b\d{6,}\b/g, 'reference', 'Reference number', '{{Reference number}}');

  // Customer name from the greeting line, and every other place it appears
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    if (line.trim()) {
      const m = line.trim().match(GREETING_NAME_RE);
      if (m && !NOT_NAMES.has(m[1].toLowerCase())) {
        const full = m[1];
        const bare = full.replace(/^(?:Mr|Mrs|Ms|Miss|Dr|Mx)\.?\s+/, '');
        const variants = [...new Set([full, bare, ...bare.split(/\s+/).filter((p) => p.length > 1)])].sort((a, b) => b.length - a.length);
        const re = new RegExp(`(^|[^\\p{L}])(${variants.map(escapeRegex).join('|')})(?![\\p{L}])`, 'gu');
        for (const hit of phraseMatches(text, re)) add('name', 'Customer name', '{{Customer name}}', hit.start, hit.end);
      }
      break;
    }
    offset += line.length + 1;
  }
  scan(/\b(?:Mr|Mrs|Ms|Miss|Dr|Mx)\.?\s+\p{Lu}[\p{L}'’-]+/gu, 'name', 'Customer name', '{{Customer name}}');

  // Your name: the line or two after the sign-off
  const nonEmpty = [];
  let pos = 0;
  for (const line of lines) { if (line.trim()) nonEmpty.push({ line: line.trim(), start: pos + line.indexOf(line.trim()) }); pos += line.length + 1; }
  const signIdx = findLast(nonEmpty, (l) => SIGNOFF_RE.test(l.line));
  if (signIdx !== -1) {
    for (const l of nonEmpty.slice(signIdx + 1, signIdx + 3)) {
      if (/^\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+){0,2}$/u.test(l.line)) {
        add('signature', 'Your name', '{{Your name}}', l.start, l.start + l.line.length);
      }
    }
  }

  // Remove overlaps: the first kind found wins, but a longer match beats a shorter one inside it
  found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept = [];
  for (const f of found) {
    const clash = kept.find((k) => f.start < k.end && f.end > k.start);
    if (!clash) kept.push(f);
  }
  // Group identical text into one detection with several places
  const groups = [];
  for (const f of kept) {
    let g = groups.find((x) => x.kind === f.kind && x.text.toLowerCase() === f.text.toLowerCase());
    if (!g) { g = { id: `d${groups.length}`, kind: f.kind, label: f.label, placeholder: f.placeholder, text: f.text, ranges: [] }; groups.push(g); }
    g.ranges.push([f.start, f.end]);
  }
  return groups;
}

export function applyRedactions(text, detections, enabledIds) {
  const on = new Set(enabledIds);
  const ranges = [];
  for (const d of detections) if (on.has(d.id)) for (const [s, e] of d.ranges) ranges.push({ start: s, end: e, replacement: d.placeholder });
  return applyFixes(text, ranges);
}

// ───────────────────────────── Template library ─────────────────────────────

export function templateTitleFrom(text) {
  const body = bodyLines(text).split('\n').find((l) => l.trim()) || text.trim().split('\n')[0] || 'Untitled template';
  const short = body.replace(PLACEHOLDER_RE, '').replace(/\s+/g, ' ').trim();
  return short.length > 60 ? short.slice(0, 57).replace(/\s+\S*$/, '') + '…' : short || 'Untitled template';
}

export function allLabels(templates, groups) {
  const out = {};
  for (const g of groups) out[g.key] = new Set(g.options);
  for (const t of templates) for (const [k, list] of Object.entries(t.labels || {})) {
    if (!out[k]) out[k] = new Set();
    list.forEach((l) => out[k].add(l));
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}

export function searchTemplates(templates, { query = '', type = null, label = null } = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return templates
    .filter((t) => !type || t.type === type)
    .filter((t) => !label || (t.labels?.[label.group] || []).includes(label.value))
    .filter((t) => {
      if (!terms.length) return true;
      const hay = [t.title, t.text, t.note, ...Object.values(t.labels || {}).flat()].join(' ').toLowerCase();
      return terms.every((w) => hay.includes(w));
    })
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export function mergeTemplates(current, incoming) {
  const byId = new Map(current.map((t) => [t.id, t]));
  let added = 0, updated = 0;
  for (const t of incoming) {
    if (!t || !t.id || typeof t.text !== 'string') continue;
    const have = byId.get(t.id);
    if (!have) { byId.set(t.id, t); added++; }
    else if ((t.updated || 0) > (have.updated || 0)) { byId.set(t.id, t); updated++; }
  }
  return { templates: [...byId.values()], added, updated };
}

export function placeholderNames(text) {
  const out = [];
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text))) out.push(m[1].trim());
  return out;
}

// Where the new text differs from the old, as [start, end] ranges in the new text.
// `diffParts` is the output of a word diff (jsdiff's diffWordsWithSpace).
export function addedRanges(diffParts) {
  const out = [];
  let pos = 0;
  for (const part of diffParts) {
    if (part.removed) continue;
    const end = pos + part.value.length;
    if (part.added) {
      const s = pos + (part.value.length - part.value.trimStart().length);
      const e = end - (part.value.length - part.value.trimEnd().length);
      out.push([s, e > s ? e : end]);
    }
    pos = end;
  }
  return out;
}
