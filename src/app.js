// The page: wires the engine to the interface. Everything stays on this page.
import nspell from 'nspell';
import * as E from './engine.js';
import { SAMPLES, EXAMPLE_TEMPLATES, LABEL_GROUPS, AVOID_DEFAULT } from './rules.js';

const VERSION = '1.0.0';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = E.escapeHtml;

// ───────────────────────────── Storage (this browser only) ─────────────────────────────

let storageOk = true;
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('wa.v1.' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { storageOk = false; return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('wa.v1.' + key, JSON.stringify(value)); } catch { storageOk = false; }
  },
};

// ───────────────────────────── Icons ─────────────────────────────

const ICON = {
  check: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.3 9.5"/></svg>',
  checkFilled: '<svg viewBox="0 0 24 24" class="check-icon ok"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="m7.8 12.3 2.8 2.8 5.6-5.8" stroke="#fff" stroke-width="2"/></svg>',
  circle: '<svg viewBox="0 0 24 24" class="check-icon no"><circle cx="12" cy="12" r="9.5"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13 3.5V8h5M9.5 12.5h6M9.5 16h6"/></svg>',
  tray: '<svg viewBox="0 0 24 24"><path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
  bubble: '<svg viewBox="0 0 24 24"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.4"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="m4 20 1-4.5L15.5 5 19 8.5 8.5 19z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/></svg>',
  pencilLine: '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="m6 16 1-3.5L15.5 4 19 7.5 10.5 16z"/></svg>',
};

// ───────────────────────────── State ─────────────────────────────

function loadSettings() {
  const saved = store.get('settings', {});
  return {
    ...E.DEFAULT_SETTINGS,
    ...saved,
    checks: { ...E.DEFAULT_SETTINGS.checks, ...(saved.checks || {}) },
    avoid: Array.isArray(saved.avoid) ? saved.avoid : AVOID_DEFAULT.map((a) => ({ ...a })),
    disabledRules: Array.isArray(saved.disabledRules) ? saved.disabledRules : [],
  };
}

const state = {
  settings: loadSettings(),
  templates: store.get('templates', []),
  dictionary: store.get('dictionary', []),
  ignored: store.get('ignored', []),
  type: store.get('type', 'email'),
  panel: 'issues',
  issues: [],
  activeId: null,
  activeRef: null,
  filter: null,
  checker: null,
  suggestions: new Map(),
  history: [],
  caret: { start: 0, end: 0 },
  save: null,
  lib: { query: '', filter: { kind: 'all' }, selectedId: null, mode: 'view', confirm: null },
};

const ta = $('#editor');
const backdrop = $('#backdrop');
const scroller = $('#editor-scroll');

function saveSettings() { store.set('settings', state.settings); }
function saveTemplates() { store.set('templates', state.templates); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const dateFmt = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// ───────────────────────────── Toast ─────────────────────────────

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  // An open sheet sits above the page, so the toast moves inside it to stay visible.
  const host = document.querySelector('dialog[open]') || document.body;
  if (el.parentNode !== host) host.appendChild(el);
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ───────────────────────────── Editing the text ─────────────────────────────

function replaceRange(start, end, str, { record = true } = {}) {
  const before = ta.value;
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(start, end);
  let ok = false;
  try {
    if (str) ok = document.execCommand('insertText', false, str);
    else if (start !== end) ok = document.execCommand('delete');
    else ok = true;
  } catch { ok = false; }
  const expected = before.slice(0, start) + str + before.slice(end);
  if (!ok || ta.value !== expected) {
    ta.value = expected;
    ta.setSelectionRange(start + str.length, start + str.length);
  }
  if (record && ta.value !== before) {
    state.history.push({ before, after: ta.value });
    if (state.history.length > 40) state.history.shift();
  }
  onTextChanged(true);
}

function setAll(text, opts) { replaceRange(0, ta.value.length, text, opts); }

function undo() {
  const top = state.history[state.history.length - 1];
  if (!top || top.after !== ta.value) return;
  state.history.pop();
  replaceRange(0, ta.value.length, top.before, { record: false });
  toast('Undone');
}

let checkTimer, draftTimer;
function onTextChanged(immediate = false) {
  clearTimeout(checkTimer);
  if (immediate) runCheck();
  else checkTimer = setTimeout(runCheck, 140);
  autosize();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => store.set('draft', ta.value), 400);
}

function autosize() {
  ta.style.height = 'auto';
  ta.style.height = Math.max(ta.scrollHeight, scroller.clientHeight) + 'px';
}

function selectRange(start, end) {
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(start, end);
  requestAnimationFrame(() => scrollToOffset(start));
}

function scrollToOffset(offset) {
  // Measure where `offset` sits by placing a marker in a copy of the highlight layer.
  const probe = document.createElement('div');
  probe.className = 'backdrop';
  probe.style.visibility = 'hidden';
  probe.innerHTML = esc(ta.value.slice(0, offset)) + '<span id="probe-mark">|</span>';
  backdrop.parentNode.appendChild(probe);
  const mark = probe.querySelector('#probe-mark');
  const top = mark.offsetTop;
  probe.remove();
  const view = scroller.clientHeight;
  if (top < scroller.scrollTop + 40 || top > scroller.scrollTop + view - 60) {
    scroller.scrollTo({ top: Math.max(0, top - view / 3), behavior: 'smooth' });
  }
  // On small screens the editor is not its own scroller; bring it into the window too.
  if (window.innerWidth <= 960) {
    const rect = scroller.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight * 0.6) scroller.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ───────────────────────────── Checking ─────────────────────────────

function runCheck() {
  const text = ta.value;
  state.issues = E.check(text, {
    settings: state.settings,
    checker: state.checker,
    personal: state.dictionary,
    ignored: state.ignored,
  });
  // Keep the same issue selected after the text changes, if it still exists.
  if (state.activeRef) {
    const r = state.activeRef;
    const same = state.issues.find((i) => i.rule === r.rule && i.text === r.text && Math.abs(i.start - r.start) < 400);
    const next = r.after != null ? state.issues.find((i) => i.start >= r.after && i.category !== 'long') : null;
    const pick = r.after != null ? next : same;
    state.activeId = pick ? pick.id : null;
    state.activeRef = pick ? { rule: pick.rule, text: pick.text, start: pick.start } : null;
  } else {
    state.activeId = null;
  }
  if (state.filter && !state.issues.some((i) => i.category === state.filter)) state.filter = null;
  renderHighlights();
  renderIssues();
  renderChecklist();
  renderStats();
  renderScoreStrip();
  updateButtons();
  queueSuggestions();
}

function renderHighlights() {
  backdrop.innerHTML = E.highlightHtml(ta.value, state.issues, state.activeId);
}

function updateButtons() {
  const has = ta.value.trim().length > 0;
  const top = state.history[state.history.length - 1];
  $('#btn-undo').disabled = !(top && top.after === ta.value);
  $('#btn-copy').disabled = !has;
  $('#btn-save').disabled = !has;
  $('#btn-clean').disabled = !has;
  $('#btn-clear').disabled = !has;
  $('#sample-badge').hidden = !SAMPLES.some((s) => s.text === ta.value);
}

function setActive(id, { select = false, scrollCard = false } = {}) {
  const issue = state.issues.find((i) => i.id === id) || null;
  state.activeId = issue ? issue.id : null;
  state.activeRef = issue ? { rule: issue.rule, text: issue.text, start: issue.start } : null;
  renderHighlights();
  $$('.issue', $('#panel-issues')).forEach((card) => card.classList.toggle('active', card.dataset.id === state.activeId));
  if (issue) {
    const card = $(`.issue[data-id="${issue.id}"]`);
    if (card && !card.querySelector('[data-suggest-ready]') && issue.category === 'spelling') renderIssues();
    if (select) selectRange(issue.start, issue.end);
    if (scrollCard) {
      if (state.panel !== 'issues') return;
      const c = $(`.issue[data-id="${issue.id}"]`);
      if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

// Spelling suggestions take a moment each, so they are worked out in small batches.
let suggesting = false;
function suggestionsFor(word) {
  if (!state.checker) return [];
  if (!state.suggestions.has(word)) {
    let list = [];
    try { list = state.checker.suggest(word).slice(0, 3); } catch { list = []; }
    state.suggestions.set(word, list);
  }
  return state.suggestions.get(word);
}
function queueSuggestions() {
  if (suggesting || !state.checker) return;
  const pending = () => state.issues.filter((i) => i.category === 'spelling' && !state.suggestions.has(i.word)).slice(0, 60);
  if (!pending().length) return;
  suggesting = true;
  const step = () => {
    const batch = pending().slice(0, 4);
    if (!batch.length) { suggesting = false; renderIssues(); return; }
    batch.forEach((i) => suggestionsFor(i.word));
    setTimeout(step, 0);
  };
  setTimeout(step, 30);
}

function matchCase(original, word) {
  if (/^\p{Lu}/u.test(original)) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

function fixesFor(issue) {
  if (issue.category !== 'spelling') return issue.fixes;
  if (!state.suggestions.has(issue.word)) return null;
  return suggestionsFor(issue.word).map((s) => {
    const rep = matchCase(issue.text, s).replace(/'/g, state.settings.quotes === 'straight' ? "'" : '’');
    return { label: rep, start: issue.start, end: issue.end, replacement: rep };
  });
}

const SIMPLE = new Set(['wordy', 'filler', 'shouty', 'repeat', 'avoid']);
function simpleFixes() {
  return state.issues.filter((i) => SIMPLE.has(i.category) && i.fixes.length).map((i) => i.fixes[0]);
}

function renderIssues() {
  const panel = $('#panel-issues');
  const keep = panel.scrollTop;
  const text = ta.value;
  const all = state.issues;
  const countEl = $('#issue-count');
  countEl.textContent = text.trim() ? String(all.length) : '';
  countEl.classList.toggle('has', all.length > 0);
  if (!text.trim()) {
    panel.innerHTML = `<div class="empty muted">${ICON.pencilLine}<strong>Nothing to check yet</strong><p>Paste or type a message, or pick a sample at the top of the draft.</p></div>`;
    return;
  }
  if (!all.length) {
    panel.innerHTML = `<div class="empty">${ICON.check}<strong>Looks good</strong><p>No suggestions for this message.</p></div>`;
    return;
  }
  const counts = {};
  all.forEach((i) => { counts[i.category] = (counts[i.category] || 0) + 1; });
  const shown = state.filter ? all.filter((i) => i.category === state.filter) : all;
  const simple = simpleFixes().length;
  let html = `<div class="panel-head"><h3>${plural(all.length, 'suggestion')}</h3>${simple ? `<button type="button" class="text-button strong" data-act="fix-all">Fix ${simple} Simple</button>` : ''}</div>`;
  html += `<div class="chips" role="group" aria-label="Show only">`;
  html += `<button type="button" class="chip" data-filter="" aria-pressed="${!state.filter}">All</button>`;
  for (const [cat, meta] of Object.entries(E.CATEGORIES)) {
    if (!counts[cat]) continue;
    html += `<button type="button" class="chip tone-${meta.tone}" data-filter="${cat}" aria-pressed="${state.filter === cat}"><span class="dot"></span>${meta.name} <span class="n">${counts[cat]}</span></button>`;
  }
  html += `</div>`;
  const LIMIT = 150;
  for (const issue of shown.slice(0, LIMIT)) html += issueCard(issue);
  if (shown.length > LIMIT) html += `<p class="more-note">${shown.length - LIMIT} more. Fix the ones above to see them.</p>`;
  panel.innerHTML = html;
  panel.scrollTop = keep;
}

function issueCard(issue) {
  const meta = E.CATEGORIES[issue.category];
  const active = issue.id === state.activeId;
  let shownText = issue.text;
  if (issue.category === 'long') shownText = issue.text.length > 90 ? issue.text.slice(0, 87).replace(/\s+\S*$/, '') + '…' : issue.text;
  if (issue.category === 'placeholder') shownText = issue.label;
  const struck = issue.fixes.length && issue.category !== 'spelling' && issue.fixes[0].replacement === '' ? ' struck' : '';
  let actions = '';
  const fixes = fixesFor(issue);
  if (fixes === null) actions += `<span class="issue-msg" style="display:block">Finding suggestions…</span>`;
  else fixes.forEach((f, n) => {
    actions += `<button type="button" class="fix${n ? ' secondary' : ''}" data-fix="${n}" title="${esc(f.label)}">${esc(f.label)}</button>`;
  });
  let more = '';
  if (issue.category === 'spelling') {
    more += `<button type="button" class="text-button" data-act="add-word">Add to Dictionary</button>`;
    more += `<button type="button" class="text-button" data-act="ignore">Ignore</button>`;
  } else if (issue.category !== 'placeholder') {
    more += `<button type="button" class="text-button" data-act="ignore">Ignore</button>`;
    if (issue.rule.includes(':') || ['passive', 'long'].includes(issue.rule)) more += `<button type="button" class="text-button" data-act="rule-off">Turn Off Rule</button>`;
  }
  let msg = issue.message;
  if (issue.category === 'spelling' && fixes && !fixes.length) msg = 'Not in the dictionary, and no close matches.';
  if (issue.category === 'placeholder') msg = 'Click to select the blank, then type over it. Press Tab to jump to the next blank.';
  return `<div class="issue tone-${meta.tone}${active ? ' active' : ''}" data-id="${issue.id}" ${fixes ? 'data-suggest-ready' : ''}>
    <div class="issue-top"><span class="dot"></span><span class="issue-cat">${meta.name}</span></div>
    <div class="issue-text${struck}">${issue.category === 'long' || issue.category === 'placeholder' ? esc(shownText) : '“' + esc(shownText) + '”'}</div>
    <p class="issue-msg">${esc(msg)}</p>
    ${actions || more ? `<div class="issue-actions">${actions}${more ? `<span class="issue-more">${more}</span>` : ''}</div>` : ''}
  </div>`;
}

function applyIssueFix(issue, fix) {
  state.activeRef = { after: fix.start + fix.replacement.length };
  replaceRange(fix.start, fix.end, fix.replacement);
}

$('#panel-issues').addEventListener('click', (e) => {
  const filterBtn = e.target.closest('[data-filter]');
  if (filterBtn) { state.filter = filterBtn.dataset.filter || null; renderIssues(); return; }
  if (e.target.closest('[data-act="fix-all"]')) {
    const fixes = simpleFixes();
    const n = fixes.length;
    state.activeRef = null;
    setAll(E.applyFixes(ta.value, fixes));
    toast(`Applied ${plural(n, 'fix', 'fixes')}`);
    return;
  }
  const card = e.target.closest('.issue');
  if (!card) return;
  const issue = state.issues.find((i) => i.id === card.dataset.id);
  if (!issue) return;
  const fixBtn = e.target.closest('[data-fix]');
  if (fixBtn) { applyIssueFix(issue, fixesFor(issue)[Number(fixBtn.dataset.fix)]); return; }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'ignore') {
    state.ignored.push(E.issueKey(issue));
    store.set('ignored', state.ignored);
    runCheck();
    toast('Ignored. You can bring it back in Settings.');
    return;
  }
  if (act === 'rule-off') {
    state.settings.disabledRules.push(issue.rule);
    saveSettings();
    runCheck();
    toast(`Turned off “${ruleName(issue.rule)}”. Turn it back on in Settings.`);
    return;
  }
  if (act === 'add-word') {
    state.dictionary.push(issue.word);
    store.set('dictionary', state.dictionary);
    runCheck();
    toast(`Added “${issue.word}” to your dictionary`);
    return;
  }
  setActive(issue.id, { select: true });
});

function ruleName(rule) {
  if (rule === 'passive') return 'Passive voice';
  if (rule === 'long') return 'Long sentences';
  if (rule === 'repeat:double') return 'Word twice in a row';
  if (rule === 'repeat:near') return 'Repeated words nearby';
  if (rule === 'shouty:caps') return 'Words in capitals';
  if (rule === 'shouty:multi') return 'Several exclamation marks';
  if (rule === 'shouty:exclaim') return 'More than one exclamation mark';
  const [cat, phrase] = rule.split(/:(.*)/s);
  return phrase ? `${E.CATEGORIES[cat]?.name || cat}: ${phrase}` : rule;
}

// ───────────────────────────── Checklist and stats ─────────────────────────────

function renderChecklist() {
  const panel = $('#panel-checklist');
  const countEl = $('#check-count');
  const def = E.MESSAGE_TYPES[state.type];
  const items = E.checklist(ta.value, state.type);
  if (!items.length) {
    countEl.textContent = '';
    panel.innerHTML = `<div class="empty muted">${ICON.doc}<strong>No checklist for General</strong><p>Choose Email or Complaint reply at the top to check the message has every part it needs.</p></div>`;
    return;
  }
  const ok = items.filter((i) => i.ok).length;
  countEl.textContent = `${ok}/${items.length}`;
  countEl.classList.toggle('done', ok === items.length);
  countEl.classList.toggle('has', false);
  let html = `<div class="panel-head"><h3>${esc(def.name)}</h3><span class="row-value">${ok} of ${items.length}</span></div>`;
  html += `<div class="list">`;
  for (const it of items) {
    html += `<div class="row with-icon">${it.ok ? ICON.checkFilled : ICON.circle}<div class="row-main"><span class="row-title">${esc(it.label)}</span>${it.ok ? '' : `<span class="row-sub">${esc(it.hint)}</span>`}</div></div>`;
  }
  html += `</div>`;
  if (ok === items.length) html += `<p class="section-note">Every part is there. If this one is a keeper, choose Mark as Perfect to save it as a template.</p>`;
  else html += `<p class="section-note">Ticks update as you type.</p>`;
  panel.innerHTML = html;
}

function renderStats() {
  const s = E.scores(ta.value);
  const panel = $('#panel-stats');
  if (!s.words) {
    panel.innerHTML = `<div class="empty muted">${ICON.doc}<strong>No text yet</strong><p>Word counts and reading ease appear here as you write.</p></div>`;
    return;
  }
  const ease = s.readingEase;
  const easeColour = ease >= 60 ? 'var(--green)' : ease >= 50 ? 'var(--orange)' : 'var(--red)';
  panel.innerHTML = `
    <div class="list"><div class="row"><div class="row-main">
      <span class="row-sub">Reading ease</span>
      <span class="big-number">${ease}<span style="font-size:15px;font-weight:500;color:var(--secondary)"> / 100 · ${esc(s.readingLabel)}</span></span>
      <div class="meter"><span style="width:${ease}%;background:${easeColour}"></span></div>
    </div></div></div>
    <p class="section-note">60 or more is plain English. Shorter sentences and shorter words raise the score.</p>
    <div class="list">
      <div class="row"><span class="row-main row-title">Words</span><span class="row-value">${s.words}</span></div>
      <div class="row"><span class="row-main row-title">Characters</span><span class="row-value">${s.characters}</span></div>
      <div class="row"><span class="row-main row-title">Sentences</span><span class="row-value">${s.sentences}</span></div>
      <div class="row"><span class="row-main row-title">Average sentence</span><span class="row-value">${s.avgSentence} words</span></div>
      <div class="row"><span class="row-main row-title">Reading time</span><span class="row-value">about ${plural(s.readingMinutes, 'minute')}</span></div>
      <div class="row"><span class="row-main row-title">Longest sentence</span><span class="row-value">${s.longest ? s.longest.words + ' words' : '—'}</span>${s.longest ? '<button type="button" class="text-button" data-act="longest">Show</button>' : ''}</div>
    </div>`;
}

function renderScoreStrip() {
  const s = E.scores(ta.value);
  const strip = $('#score-strip');
  if (!s.words) { strip.innerHTML = '<span>0 words</span>'; return; }
  strip.innerHTML = `<span><b>${s.words}</b> ${s.words === 1 ? 'word' : 'words'}</span>
    <span><b>${s.avgSentence}</b> words per sentence</span>
    <span>Reading ease <b>${s.readingEase}</b> · ${esc(s.readingLabel)}</span>
    <span class="grow"></span>
    ${s.longest ? `<button type="button" class="text-button" data-act="longest">Longest sentence: ${s.longest.words} words</button>` : ''}`;
}

function showLongest() {
  const s = E.scores(ta.value);
  if (s.longest) selectRange(s.longest.start, s.longest.end);
}
$('#score-strip').addEventListener('click', (e) => { if (e.target.closest('[data-act="longest"]')) showLongest(); });
$('#panel-stats').addEventListener('click', (e) => { if (e.target.closest('[data-act="longest"]')) showLongest(); });

// ───────────────────────────── Toolbar ─────────────────────────────

function setType(type) {
  state.type = E.MESSAGE_TYPES[type] ? type : 'general';
  store.set('type', state.type);
  $$('#type-control button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === state.type)));
  renderChecklist();
}
$('#type-control').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setType(b.dataset.type);
});

function setPanel(panel) {
  state.panel = panel;
  $$('#panel-control button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.panel === panel)));
  ['issues', 'checklist', 'stats'].forEach((p) => { $('#panel-' + p).hidden = p !== panel; });
}
$('#panel-control').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) setPanel(b.dataset.panel);
});

$('#btn-clean').addEventListener('click', () => {
  const res = E.clean(ta.value, state.settings);
  if (res.text === ta.value) { toast('Already clean'); return; }
  state.activeRef = null;
  setAll(res.text);
  toast(E.describeClean(res.counts));
});
$('#btn-undo').addEventListener('click', undo);

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.style.position = 'fixed';
    tmp.style.opacity = '0';
    document.body.appendChild(tmp);
    tmp.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    tmp.remove();
    ta.focus({ preventScroll: true });
    return ok;
  }
}
$('#btn-copy').addEventListener('click', async () => {
  const text = ta.value;
  if (!text.trim()) return;
  const ok = await copyText(text);
  const blanks = E.placeholderNames(text).length;
  if (!ok) toast('Could not copy. Select the text and press Ctrl+C or ⌘C.');
  else toast(blanks ? `Copied. ${plural(blanks, 'blank')} still to fill in.` : 'Copied');
});

$('#btn-clear').addEventListener('click', () => {
  if (!ta.value) return;
  state.activeRef = null;
  setAll('');
  toast('Cleared. Undo brings it back.');
});

const sampleSelect = $('#sample-select');
SAMPLES.forEach((s) => sampleSelect.insertAdjacentHTML('beforeend', `<option value="${s.id}">${esc(s.name)}</option>`));
sampleSelect.addEventListener('change', () => {
  const s = SAMPLES.find((x) => x.id === sampleSelect.value);
  sampleSelect.value = '';
  if (!s) return;
  state.activeRef = null;
  setAll(s.text);
  setType(s.id === 'complaint' ? 'complaint' : 'email');
  scroller.scrollTop = 0;
});

// ───────────────────────────── Editor events ─────────────────────────────

ta.addEventListener('input', () => onTextChanged());
function syncCaret() {
  const pos = ta.selectionStart;
  if (ta.selectionEnd - pos > 0 && state.issues.some((i) => i.id === state.activeId && i.start === pos)) return;
  const hits = state.issues.filter((i) => i.start <= pos && i.end >= pos);
  const pick = hits.filter((i) => i.category !== 'long').sort((a, b) => (a.end - a.start) - (b.end - b.start))[0] || hits[0];
  if (pick && pick.id !== state.activeId) setActive(pick.id, { scrollCard: true });
}
ta.addEventListener('click', syncCaret);
ta.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') syncCaret(); });
ta.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
  const blanks = [];
  let m;
  E.PLACEHOLDER_RE.lastIndex = 0;
  while ((m = E.PLACEHOLDER_RE.exec(ta.value))) blanks.push([m.index, m.index + m[0].length]);
  if (!blanks.length) return;
  e.preventDefault();
  const s = ta.selectionStart, en = ta.selectionEnd;
  let target;
  if (e.shiftKey) target = [...blanks].reverse().find(([a]) => a < s) || blanks[blanks.length - 1];
  else target = blanks.find(([a]) => a >= en && !(a === s && blanks.some(([x, y]) => x === s && y === en))) || blanks.find(([a]) => a > s) || blanks[0];
  selectRange(target[0], target[1]);
});
window.addEventListener('resize', () => autosize());

// ───────────────────────────── Dialogs ─────────────────────────────

$$('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// Label picker, shared by the save sheet and the template editor
function renderLabelPicker(container, selected) {
  const options = E.allLabels(state.templates, LABEL_GROUPS);
  let html = '';
  for (const g of LABEL_GROUPS) {
    const opts = [...new Set([...(options[g.key] || []), ...(selected[g.key] || [])])];
    html += `<div class="label-group" data-group="${g.key}"><span class="field-label">${esc(g.name)}</span><div class="label-chips">`;
    for (const o of opts) {
      const on = (selected[g.key] || []).includes(o);
      html += `<button type="button" class="chip" aria-pressed="${on}" data-label="${esc(o)}">${esc(o)}</button>`;
    }
    html += `<button type="button" class="chip chip-add" data-new>${ICON.plus.replace('<svg', '<svg style="width:13px;height:13px"')}New</button></div></div>`;
  }
  container.innerHTML = html;
}
function bindLabelPicker(container, selected) {
  container.addEventListener('click', (e) => {
    const group = e.target.closest('[data-group]')?.dataset.group;
    if (!group) return;
    const chip = e.target.closest('[data-label]');
    if (chip) {
      const v = chip.dataset.label;
      const list = selected[group] || (selected[group] = []);
      const i = list.indexOf(v);
      if (i === -1) list.push(v); else list.splice(i, 1);
      chip.setAttribute('aria-pressed', String(i === -1));
      return;
    }
    const add = e.target.closest('[data-new]');
    if (add) {
      const input = document.createElement('input');
      input.className = 'chip-input';
      input.placeholder = 'New label';
      input.maxLength = 30;
      add.replaceWith(input);
      input.focus();
      const commit = () => {
        const v = input.value.trim().replace(/\s+/g, ' ');
        if (v) {
          const list = selected[group] || (selected[group] = []);
          if (!list.includes(v)) list.push(v);
        }
        renderLabelPicker(container, selected);
      };
      input.addEventListener('keydown', (k) => {
        if (k.key === 'Enter') { k.preventDefault(); commit(); }
        if (k.key === 'Escape') { k.preventDefault(); k.stopPropagation(); renderLabelPicker(container, selected); }
      });
      input.addEventListener('blur', commit, { once: true });
    }
  });
}

function typeSegmented(container, current, onPick) {
  container.innerHTML = Object.entries(E.MESSAGE_TYPES).map(([k, v]) => `<button type="button" role="radio" data-type="${k}" aria-checked="${k === current}">${esc(v.name)}</button>`).join('');
  container.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', container).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    onPick(b.dataset.type);
  };
}

// ───────────────────────────── Save as template ─────────────────────────────

const saveSheet = $('#save-sheet');
let saveLabelsBound = false;

$('#btn-save').addEventListener('click', openSave);
function openSave() {
  const text = ta.value.trim();
  if (!text) { toast('Write a message first'); return; }
  const detections = E.findPersonalDetails(text);
  state.save = {
    source: text,
    detections,
    enabled: new Set(detections.map((d) => d.id)),
    type: state.type,
    labels: { topic: [], situation: [], tone: [] },
    edited: false,
  };
  $('#tpl-title').value = E.templateTitleFrom(text);
  $('#tpl-note').value = '';
  typeSegmented($('#tpl-type'), state.save.type, (t) => { state.save.type = t; });
  renderLabelPicker($('#tpl-labels'), state.save.labels);
  if (!saveLabelsBound) { bindLabelPicker($('#tpl-labels'), new Proxy({}, { get: (_, k) => state.save.labels[k], set: (_, k, v) => { state.save.labels[k] = v; return true; } })); saveLabelsBound = true; }
  renderRedactions();
  $('#tpl-text').value = E.applyRedactions(text, detections, [...state.save.enabled]);
  const open = state.issues.filter((i) => i.category !== 'placeholder').length;
  $('#tpl-text-note').textContent = open
    ? `This message still has ${plural(open, 'suggestion')}. You can save it anyway, or cancel and fix them first.`
    : 'Blanks look like {{Customer name}}. You can edit the text here before saving.';
  saveSheet.showModal();
  $('#tpl-title').select();
}

function renderRedactions() {
  const { detections, enabled } = state.save;
  $('#redact-note').textContent = detections.length
    ? `Found ${plural(detections.length, 'personal detail')}. Ticked ones become fill-in blanks, so no customer's details are kept.`
    : 'No personal details found. Check the text below before saving.';
  $('#redact-list').innerHTML = detections.map((d) => `
    <label class="redact-row">
      <input type="checkbox" data-id="${d.id}" ${enabled.has(d.id) ? 'checked' : ''}>
      <span class="row-main"><span class="row-sub">${esc(d.label)}${d.ranges.length > 1 ? ` · ${d.ranges.length} places` : ''}</span><span class="redact-text">${esc(d.text)}</span></span>
      <code>${esc(d.placeholder)}</code>
    </label>`).join('');
}
$('#redact-list').addEventListener('change', (e) => {
  const box = e.target.closest('input[data-id]');
  if (!box) return;
  const { enabled } = state.save;
  if (box.checked) enabled.add(box.dataset.id); else enabled.delete(box.dataset.id);
  if (state.save.edited) toast('Your edits to the template text were replaced');
  $('#tpl-text').value = E.applyRedactions(state.save.source, state.save.detections, [...enabled]);
  state.save.edited = false;
});
$('#tpl-text').addEventListener('input', () => { if (state.save) state.save.edited = true; });

$('#save-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#tpl-text').value.trim();
  const title = $('#tpl-title').value.trim() || E.templateTitleFrom(text);
  if (!text) { toast('The template text is empty'); return; }
  const now = Date.now();
  const labels = Object.fromEntries(Object.entries(state.save.labels).map(([k, v]) => [k, [...v]]));
  state.templates.unshift({ id: uid(), title, type: state.save.type, labels, note: $('#tpl-note').value.trim(), text, created: now, updated: now, uses: 0 });
  saveTemplates();
  saveSheet.close();
  toast(`Saved “${title}” to Templates`);
});

// ───────────────────────────── Template library ─────────────────────────────

const libSheet = $('#library-sheet');

$('#btn-library').addEventListener('click', openLibrary);
function openLibrary() {
  state.caret = { start: ta.selectionStart, end: ta.selectionEnd };
  state.lib.mode = 'view';
  state.lib.confirm = null;
  renderLibrary();
  libSheet.showModal();
  $('#lib-search').focus();
}

function libFilterArgs() {
  const f = state.lib.filter;
  return {
    query: state.lib.query,
    type: f.kind === 'type' ? f.value : null,
    label: f.kind === 'label' ? { group: f.group, value: f.value } : null,
  };
}

function renderLibrary() {
  renderLibSidebar();
  const list = E.searchTemplates(state.templates, libFilterArgs());
  if (!list.some((t) => t.id === state.lib.selectedId)) {
    state.lib.selectedId = list[0]?.id || null;
    state.lib.mode = 'view';
    state.lib.confirm = null;
  }
  renderLibList(list);
  renderLibDetail();
  const last = store.get('lastBackup', null);
  $('#backup-status').textContent = `${plural(state.templates.length, 'template')} · Last backup: ${last ? dateTimeFmt.format(new Date(last)) : 'never'}`;
}

function filterKey(f) {
  if (f.kind === 'type') return `type:${f.value}`;
  if (f.kind === 'label') return `label:${f.group}:${f.value}`;
  return 'all';
}

function renderLibSidebar() {
  const side = $('#lib-sidebar');
  const cur = filterKey(state.lib.filter);
  const items = [{ key: 'all', name: 'All Templates', icon: ICON.tray, n: state.templates.length }];
  const typeIcons = { email: ICON.mail, complaint: ICON.bubble, general: ICON.doc };
  const groups = [{ head: 'Message type', items: Object.entries(E.MESSAGE_TYPES).map(([k, v]) => ({ key: `type:${k}`, name: v.name, icon: typeIcons[k], n: state.templates.filter((t) => t.type === k).length })) }];
  for (const g of LABEL_GROUPS) {
    const counts = {};
    state.templates.forEach((t) => (t.labels?.[g.key] || []).forEach((l) => { counts[l] = (counts[l] || 0) + 1; }));
    const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length) groups.push({ head: g.name, items: entries.map(([l, n]) => ({ key: `label:${g.key}:${l}`, name: l, icon: ICON.tag, n })) });
  }
  const btn = (it) => `<button type="button" class="side-item" data-key="${esc(it.key)}" aria-current="${it.key === cur}">${it.icon}<span class="label">${esc(it.name)}</span><span class="n">${it.n}</span></button>`;
  let html = items.map(btn).join('');
  for (const g of groups) html += `<div class="side-head">${esc(g.head)}</div>` + g.items.map(btn).join('');
  let opts = items.map((it) => `<option value="${esc(it.key)}" ${it.key === cur ? 'selected' : ''}>${esc(it.name)} (${it.n})</option>`).join('');
  for (const g of groups) opts += `<optgroup label="${esc(g.head)}">` + g.items.map((it) => `<option value="${esc(it.key)}" ${it.key === cur ? 'selected' : ''}>${esc(it.name)} (${it.n})</option>`).join('') + '</optgroup>';
  side.innerHTML = html + `<select aria-label="Show templates">${opts}</select>`;
}

function parseFilterKey(key) {
  if (key.startsWith('type:')) return { kind: 'type', value: key.slice(5) };
  if (key.startsWith('label:')) { const [, group, ...rest] = key.split(':'); return { kind: 'label', group, value: rest.join(':') }; }
  return { kind: 'all' };
}
$('#lib-sidebar').addEventListener('click', (e) => {
  const b = e.target.closest('.side-item');
  if (!b) return;
  state.lib.filter = parseFilterKey(b.dataset.key);
  renderLibrary();
});
$('#lib-sidebar').addEventListener('change', (e) => {
  if (e.target.tagName !== 'SELECT') return;
  state.lib.filter = parseFilterKey(e.target.value);
  renderLibrary();
});
$('#lib-search').addEventListener('input', (e) => { state.lib.query = e.target.value; renderLibrary(); });

function tagsHtml(t) {
  let h = `<span class="tag type">${esc(E.MESSAGE_TYPES[t.type]?.name || 'General')}</span>`;
  for (const g of LABEL_GROUPS) (t.labels?.[g.key] || []).forEach((l) => { h += `<span class="tag">${esc(l)}</span>`; });
  if (t.example) h += `<span class="tag example">Example</span>`;
  return `<span class="tags">${h}</span>`;
}

function renderLibList(list) {
  const el = $('#lib-list');
  if (!state.templates.length) {
    el.innerHTML = `<div class="empty muted">${ICON.star}<strong>No templates yet</strong><p>Write a message you’re happy with, then choose Mark as Perfect.</p></div>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="empty muted">${ICON.tray}<strong>No matches</strong><p>Try other words, or choose All Templates.</p></div>`;
    return;
  }
  el.innerHTML = list.map((t) => `
    <button type="button" class="lib-item" data-id="${t.id}" aria-current="${t.id === state.lib.selectedId}">
      <span class="lib-item-top"><span class="lib-item-title">${esc(t.title)}</span><span class="lib-item-date">${dateFmt.format(new Date(t.updated || t.created || Date.now())).replace(/ \d{4}$/, '')}</span></span>
      <span class="lib-item-snippet">${esc(t.text.replace(E.PLACEHOLDER_RE, '[$1]').replace(/\s+/g, ' ').slice(0, 160))}</span>
      ${tagsHtml(t)}
    </button>`).join('');
}
$('#lib-list').addEventListener('click', (e) => {
  const b = e.target.closest('.lib-item');
  if (!b) return;
  state.lib.selectedId = b.dataset.id;
  state.lib.mode = 'view';
  state.lib.confirm = null;
  renderLibrary();
});

function templateHtml(text) {
  return esc(text).replace(/\{\{([^{}\n]{1,60})\}\}/g, '<span class="ph">$1</span>');
}

function renderLibDetail() {
  const el = $('#lib-detail');
  const t = state.templates.find((x) => x.id === state.lib.selectedId);
  if (!t) {
    el.innerHTML = state.templates.length ? '' : `<div class="empty muted">${ICON.doc}<strong>Your saved emails appear here</strong><p>Each one keeps its labels and a note on why it works, with customer details turned into blanks.</p></div>`;
    return;
  }
  if (state.lib.mode === 'edit') { renderLibEdit(el, t); return; }
  const blanks = [...new Set(E.placeholderNames(t.text))];
  let confirm = '';
  if (state.lib.confirm === 'use') {
    confirm = `<div class="inline-confirm"><span>Your draft already has text. Replace it, or add the template where your cursor was?</span>
      <button type="button" class="btn primary" data-act="use-replace">Replace Draft</button>
      <button type="button" class="btn" data-act="use-insert">Insert at Cursor</button>
      <button type="button" class="btn" data-act="cancel">Cancel</button></div>`;
  }
  el.innerHTML = `
    <h3>${esc(t.title)}</h3>
    <div class="detail-meta">${tagsHtml(t)}<span>Saved ${dateFmt.format(new Date(t.created || Date.now()))}</span><span>Used ${plural(t.uses || 0, 'time')}</span></div>
    ${t.note ? `<p class="detail-note"><b>Why it works</b>${esc(t.note)}</p>` : ''}
    <div class="detail-actions">
      <button type="button" class="btn primary" data-act="use">Use Template</button>
      <button type="button" class="btn" data-act="copy">${ICON.copy}Copy</button>
      <button type="button" class="btn" data-act="edit">${ICON.pencil}Edit</button>
      <button type="button" class="btn danger${state.lib.confirm === 'delete' ? ' confirm' : ''}" data-act="delete">${ICON.trash}${state.lib.confirm === 'delete' ? 'Confirm Delete' : 'Delete'}</button>
    </div>
    ${confirm}
    <div class="template-text">${templateHtml(t.text)}</div>
    ${blanks.length ? `<p class="section-note" style="padding:0">Blanks to fill in: ${blanks.map(esc).join(', ')}.</p>` : ''}`;
}

function renderLibEdit(el, t) {
  const draft = state.lib.draft;
  el.innerHTML = `
    <div class="edit-form">
      <label>Title<input type="text" id="edit-title" maxlength="90" value="${esc(draft.title)}"></label>
      <div><span class="row-sub">Message type</span><div class="segmented" id="edit-type" style="margin-top:4px"></div></div>
      <div id="edit-labels"></div>
      <label>Why it works<textarea id="edit-note" rows="2">${esc(draft.note || '')}</textarea></label>
      <label>Template text<textarea id="edit-text" rows="12">${esc(draft.text)}</textarea></label>
      <div class="detail-actions">
        <button type="button" class="btn primary" data-act="save-edit">Save Changes</button>
        <button type="button" class="btn" data-act="cancel-edit">Cancel</button>
      </div>
    </div>`;
  typeSegmented($('#edit-type'), draft.type, (v) => { draft.type = v; });
  const labelsBox = $('#edit-labels');
  renderLabelPicker(labelsBox, draft.labels);
  bindLabelPicker(labelsBox, draft.labels);
  $('#edit-title').addEventListener('input', (e) => { draft.title = e.target.value; });
  $('#edit-note').addEventListener('input', (e) => { draft.note = e.target.value; });
  $('#edit-text').addEventListener('input', (e) => { draft.text = e.target.value; });
}

$('#lib-detail').addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const t = state.templates.find((x) => x.id === state.lib.selectedId);
  if (!act || !t) return;
  if (act !== 'delete' && state.lib.confirm === 'delete') state.lib.confirm = null;
  if (act === 'use') {
    if (ta.value.trim() && ta.value !== t.text) { state.lib.confirm = 'use'; renderLibDetail(); return; }
    useTemplate(t, 'replace');
  } else if (act === 'use-replace') useTemplate(t, 'replace');
  else if (act === 'use-insert') useTemplate(t, 'insert');
  else if (act === 'cancel') { state.lib.confirm = null; renderLibDetail(); }
  else if (act === 'copy') { const ok = await copyText(t.text); toast(ok ? 'Template copied' : 'Could not copy'); }
  else if (act === 'edit') {
    state.lib.mode = 'edit';
    state.lib.draft = { title: t.title, type: t.type, note: t.note || '', text: t.text, labels: JSON.parse(JSON.stringify(t.labels || {})) };
    renderLibDetail();
  } else if (act === 'save-edit') {
    const d = state.lib.draft;
    if (!d.text.trim()) { toast('The template text is empty'); return; }
    Object.assign(t, { title: d.title.trim() || E.templateTitleFrom(d.text), type: d.type, note: d.note.trim(), text: d.text, labels: d.labels, updated: Date.now() });
    delete t.example;
    saveTemplates();
    state.lib.mode = 'view';
    renderLibrary();
    toast('Changes saved');
  } else if (act === 'cancel-edit') { state.lib.mode = 'view'; renderLibDetail(); }
  else if (act === 'delete') {
    if (state.lib.confirm !== 'delete') { state.lib.confirm = 'delete'; renderLibDetail(); return; }
    state.templates = state.templates.filter((x) => x.id !== t.id);
    saveTemplates();
    state.lib.confirm = null;
    renderLibrary();
    toast(`Deleted “${t.title}”`);
  }
});

function useTemplate(t, mode) {
  libSheet.close();
  let at = 0;
  state.activeRef = null;
  if (mode === 'insert') {
    const { start, end } = state.caret;
    const before = ta.value.slice(0, start);
    const pad = before && !before.endsWith('\n') ? '\n\n' : '';
    replaceRange(start, end, pad + t.text);
    at = start + pad.length;
  } else {
    setAll(t.text);
  }
  if (t.type && t.type !== 'general') setType(t.type);
  t.uses = (t.uses || 0) + 1;
  t.lastUsed = Date.now();
  saveTemplates();
  setPanel('issues');
  const blanks = E.placeholderNames(t.text).length;
  E.PLACEHOLDER_RE.lastIndex = at;
  const first = E.PLACEHOLDER_RE.exec(ta.value);
  if (first) selectRange(first.index, first.index + first[0].length);
  else scroller.scrollTop = 0;
  toast(blanks ? `Template added. ${plural(blanks, 'blank')} to fill in. Press Tab to jump between them.` : 'Template added');
}

// ───────────────────────────── Backup ─────────────────────────────

function exportBackup() {
  const data = {
    app: 'writing-assistant',
    version: 1,
    exported: new Date().toISOString(),
    templates: state.templates,
    dictionary: state.dictionary,
    ignored: state.ignored,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `writing-assistant-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  store.set('lastBackup', Date.now());
  if (libSheet.open) renderLibrary();
  if ($('#settings-sheet').open) renderSettings();
  toast('Backup file saved');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch { data = null; }
    if (!data || !Array.isArray(data.templates)) { toast('That file is not a Writing Assistant backup'); return; }
    const res = E.mergeTemplates(state.templates, data.templates);
    state.templates = res.templates;
    saveTemplates();
    if (Array.isArray(data.dictionary)) {
      state.dictionary = [...new Set([...state.dictionary, ...data.dictionary.filter((w) => typeof w === 'string')])];
      store.set('dictionary', state.dictionary);
    }
    if (Array.isArray(data.ignored)) {
      state.ignored = [...new Set([...state.ignored, ...data.ignored.filter((w) => typeof w === 'string')])];
      store.set('ignored', state.ignored);
    }
    const s = data.settings || {};
    if (Array.isArray(s.avoid)) {
      const have = new Set(state.settings.avoid.map((a) => a.phrase.toLowerCase()));
      s.avoid.filter((a) => a && typeof a.phrase === 'string' && !have.has(a.phrase.toLowerCase())).forEach((a) => state.settings.avoid.push({ phrase: a.phrase, swap: a.swap ?? null, why: a.why || '' }));
    }
    if (Array.isArray(s.disabledRules)) state.settings.disabledRules = [...new Set([...state.settings.disabledRules, ...s.disabledRules])];
    saveSettings();
    runCheck();
    if (libSheet.open) renderLibrary();
    if ($('#settings-sheet').open) renderSettings();
    toast(`Imported ${plural(res.added, 'new template')}${res.updated ? `, updated ${res.updated}` : ''}`);
  };
  reader.readAsText(file);
}

const importInput = $('#import-file');
importInput.addEventListener('change', () => {
  if (importInput.files[0]) importBackup(importInput.files[0]);
  importInput.value = '';
});
document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-action]')?.dataset.action;
  if (act === 'export') exportBackup();
  if (act === 'import') importInput.click();
});

// ───────────────────────────── Settings ─────────────────────────────

const settingsSheet = $('#settings-sheet');
$('#btn-settings').addEventListener('click', () => { renderSettings(); settingsSheet.showModal(); });

const CHECK_ROWS = [
  ['spelling', 'Spelling', 'New Zealand English, with common te reo Māori words'],
  ['filler', 'Filler words', 'just, very, basically, actually'],
  ['wordy', 'Wordy phrases', '“in order to” → “to”, “utilise” → “use”'],
  ['avoid', 'Your phrase list', 'The phrases you list below'],
  ['passive', 'Passive voice', '“was sent” → say who sent it'],
  ['long', 'Long sentences', null],
  ['repeat', 'Repeated words', 'The same word twice close together'],
  ['shouty', 'Shouting', 'Words in capitals and extra exclamation marks'],
  ['placeholder', 'Blanks to fill in', 'Template blanks like {{Customer name}}'],
];

function seg(name, value, options) {
  return `<div class="segmented" data-setting="${name}">${options.map(([v, label]) => `<button type="button" role="radio" data-value="${v}" aria-checked="${value === v}">${esc(label)}</button>`).join('')}</div>`;
}
function sw(id, on) {
  return `<label class="switch"><input type="checkbox" data-check="${id}" ${on ? 'checked' : ''} aria-label="${id}"><span></span></label>`;
}
const swapShown = (s) => (s === '' ? '(remove)' : s ?? '');

function renderSettings() {
  const s = state.settings;
  const last = store.get('lastBackup', null);
  let html = `
    <h3 class="group-title">Clean-up</h3>
    <div class="group">
      <div class="field"><span class="field-label">Quote marks</span>${seg('quotes', s.quotes, [['curly', '“Curly”'], ['straight', '"Straight"'], ['keep', 'Leave']])}</div>
      <div class="field"><span class="field-label">Dashes</span>${seg('dashes', s.dashes, [['en', 'Spaced –'], ['em', 'Em —'], ['keep', 'Leave']])}</div>
      <div class="field"><span class="field-label">Bullets</span>${seg('bullets', s.bullets, [['•', '•'], ['–', '–'], ['-', '-']])}</div>
    </div>

    <h3 class="group-title">Checks</h3>
    <div class="group">`;
  for (const [id, name, sub] of CHECK_ROWS) {
    if (id === 'long') {
      html += `<div class="field"><span class="row-main"><span class="row-title">${name}</span><span class="row-sub">Flag sentences over ${s.longSentence} words</span></span>
        <span class="stepper"><button type="button" data-step="-1" aria-label="Fewer words">−</button><output>${s.longSentence}</output><button type="button" data-step="1" aria-label="More words">+</button></span>${sw(id, s.checks[id])}</div>`;
    } else {
      html += `<div class="field"><span class="row-main"><span class="row-title">${name}</span><span class="row-sub">${esc(sub)}</span></span>${sw(id, s.checks[id])}</div>`;
    }
    if (id === 'spelling') {
      html += `<div class="field"><span class="row-main"><span class="row-title">Check capitalised words</span><span class="row-sub">Off skips names in the middle of a sentence</span></span><label class="switch"><input type="checkbox" data-flag="checkCapitalised" ${s.checkCapitalised ? 'checked' : ''} aria-label="Check capitalised words"><span></span></label></div>`;
    }
  }
  html += `</div>

    <h3 class="group-title">Your phrase list</h3>
    <div class="group" id="avoid-group">
      <div class="phrase-row phrase-head"><span>Phrase to avoid</span><span>Suggest instead</span><span>Why</span><span></span></div>
      ${s.avoid.map((a, i) => `<div class="phrase-row" data-i="${i}">
        <input type="text" data-k="phrase" value="${esc(a.phrase)}" aria-label="Phrase to avoid">
        <input type="text" data-k="swap" value="${esc(swapShown(a.swap))}" placeholder="No automatic fix" aria-label="Suggest instead">
        <input type="text" data-k="why" value="${esc(a.why || '')}" aria-label="Why">
        <button type="button" class="icon-button" data-remove-phrase="${i}" aria-label="Remove ${esc(a.phrase)}">${ICON.trash}</button>
      </div>`).join('')}
      <div class="field" style="justify-content:space-between">
        <button type="button" class="text-button strong" data-add-phrase>Add Phrase</button>
        <button type="button" class="text-button" data-reset-phrases>Reset to Defaults</button>
      </div>
      <p class="group-note">Leave “Suggest instead” empty for no automatic fix, or type (remove) to offer deleting the phrase.</p>
    </div>

    <h3 class="group-title">Personal dictionary</h3>
    <div class="group">
      <div class="dict-chips">${state.dictionary.length ? state.dictionary.map((w, i) => `<span class="chip">${esc(w)}<button type="button" data-remove-word="${i}" aria-label="Remove ${esc(w)}">${ICON.x}</button></span>`).join('') : '<span class="row-sub">Words you add from a spelling suggestion appear here.</span>'}</div>
      <div class="field"><input type="text" id="new-word" placeholder="Add a word, such as a product name" aria-label="New word"><button type="button" class="text-button strong" data-add-word>Add</button></div>
    </div>

    <h3 class="group-title">Turned off and ignored</h3>
    <div class="group">
      ${s.disabledRules.length ? s.disabledRules.map((r, i) => `<div class="field"><span class="row-main row-title">${esc(ruleName(r))}</span><button type="button" class="text-button" data-rule-on="${i}">Turn On</button></div>`).join('') : '<p class="group-note">No rules turned off.</p>'}
      <div class="field"><span class="row-main row-title">Ignored suggestions</span><span class="row-value">${state.ignored.length}</span><button type="button" class="text-button" data-clear-ignored ${state.ignored.length ? '' : 'disabled'}>Bring Back All</button></div>
    </div>

    <h3 class="group-title">Backup</h3>
    <div class="group">
      <div class="field"><span class="row-main"><span class="row-title">Templates, settings and dictionary</span><span class="row-sub">Last backup: ${last ? dateTimeFmt.format(new Date(last)) : 'never'}</span></span>
        <button type="button" class="text-button" data-action="import">Import…</button><button type="button" class="text-button strong" data-action="export">Export</button></div>
    </div>

    <h3 class="group-title">About</h3>
    <div class="group">
      <p class="group-note">Writing Assistant ${VERSION}. It runs entirely inside this one file and the page blocks every network connection, so nothing you type is sent anywhere. Templates, settings and your dictionary are kept in this browser. Export a backup now and then, because clearing browser data removes them.${storageOk ? '' : ' <b>This browser is not letting the page save anything, so export a backup before you close it.</b>'}</p>
    </div>`;
  $('#settings-body').innerHTML = html;
}

function settingsChanged() { saveSettings(); runCheck(); }

$('#settings-body').addEventListener('click', (e) => {
  const s = state.settings;
  const segBtn = e.target.closest('[data-setting] button');
  if (segBtn) {
    const name = segBtn.parentElement.dataset.setting;
    s[name] = segBtn.dataset.value;
    $$('button', segBtn.parentElement).forEach((b) => b.setAttribute('aria-checked', String(b === segBtn)));
    settingsChanged();
    return;
  }
  const step = e.target.closest('[data-step]');
  if (step) {
    s.longSentence = Math.min(60, Math.max(10, s.longSentence + Number(step.dataset.step)));
    settingsChanged();
    renderSettings();
    return;
  }
  const rm = e.target.closest('[data-remove-phrase]');
  if (rm) { s.avoid.splice(Number(rm.dataset.removePhrase), 1); settingsChanged(); renderSettings(); return; }
  if (e.target.closest('[data-add-phrase]')) {
    s.avoid.push({ phrase: '', swap: null, why: '' });
    saveSettings();
    renderSettings();
    const rows = $$('#avoid-group .phrase-row[data-i]');
    rows[rows.length - 1]?.querySelector('input')?.focus();
    return;
  }
  if (e.target.closest('[data-reset-phrases]')) { s.avoid = AVOID_DEFAULT.map((a) => ({ ...a })); settingsChanged(); renderSettings(); return; }
  const rw = e.target.closest('[data-remove-word]');
  if (rw) { state.dictionary.splice(Number(rw.dataset.removeWord), 1); store.set('dictionary', state.dictionary); runCheck(); renderSettings(); return; }
  if (e.target.closest('[data-add-word]')) { addWordFromField(); return; }
  const on = e.target.closest('[data-rule-on]');
  if (on) { s.disabledRules.splice(Number(on.dataset.ruleOn), 1); settingsChanged(); renderSettings(); return; }
  if (e.target.closest('[data-clear-ignored]')) { state.ignored = []; store.set('ignored', []); runCheck(); renderSettings(); toast('Ignored suggestions are back'); }
});

function addWordFromField() {
  const input = $('#new-word');
  const w = input.value.trim();
  if (!w) return;
  if (!state.dictionary.includes(w)) state.dictionary.push(w);
  store.set('dictionary', state.dictionary);
  runCheck();
  renderSettings();
  $('#new-word').focus();
}

$('#settings-body').addEventListener('change', (e) => {
  const s = state.settings;
  const check = e.target.closest('[data-check]');
  if (check) { s.checks[check.dataset.check] = check.checked; settingsChanged(); return; }
  const flag = e.target.closest('[data-flag]');
  if (flag) { s[flag.dataset.flag] = flag.checked; settingsChanged(); return; }
  const row = e.target.closest('.phrase-row[data-i]');
  if (row) {
    const item = s.avoid[Number(row.dataset.i)];
    const k = e.target.dataset.k;
    let v = e.target.value.trim();
    if (k === 'swap') v = v === '(remove)' ? '' : v || null;
    item[k] = v;
    s.avoid = s.avoid.filter((a, i) => a.phrase || i === Number(row.dataset.i));
    settingsChanged();
  }
});
$('#settings-body').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'new-word') { e.preventDefault(); addWordFromField(); }
});
settingsSheet.addEventListener('close', () => {
  state.settings.avoid = state.settings.avoid.filter((a) => a.phrase && a.phrase.trim());
  settingsChanged();
});

// ───────────────────────────── Start ─────────────────────────────

function seedExamples() {
  if (store.get('seeded', false)) return;
  const now = Date.now();
  const examples = EXAMPLE_TEMPLATES.map((t, i) => ({ ...t, id: 'example-' + (i + 1), created: now - i * 60000, updated: now - i * 60000, uses: 0, example: true }));
  state.templates = [...state.templates, ...examples];
  saveTemplates();
  store.set('seeded', true);
}

function loadDictionary() {
  const aff = $('#dict-aff').textContent;
  const dic = $('#dict-dic').textContent;
  if (aff.length < 100 || dic.length < 1000) {
    $('#dict-status').textContent = 'Spelling unavailable in this copy. Run npm run build.';
    return;
  }
  try {
    state.checker = nspell(aff, dic);
    $('#dict-status').textContent = 'Spelling: English (New Zealand)';
  } catch {
    $('#dict-status').textContent = 'Spelling could not load';
  }
  runCheck();
}

function start() {
  seedExamples();
  setType(state.type);
  setPanel('issues');
  const draft = store.get('draft', null);
  ta.value = draft === null ? SAMPLES.find((s) => s.id === 'wordy').text : draft;
  runCheck();
  autosize();
  setTimeout(loadDictionary, 60);
  if (!storageOk) toast('This browser will not save your templates here. Export a backup to keep them.');
}

start();
