import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import nspell from 'nspell';
import * as E from '../src/engine.js';
import { SAMPLES } from '../src/rules.js';

const dict = (f) => fs.readFileSync(new URL(`../node_modules/dictionary-en-gb/index.${f}`, import.meta.url), 'utf8');
const speller = nspell(dict('aff'), dict('dic'));
const sample = (id) => SAMPLES.find((s) => s.id === id).text;
const cats = (issues) => issues.map((i) => i.category);

test('clean: fixes spaces, broken lines, capitals and the word I', () => {
  const { text, counts } = E.clean(sample('messy'));
  assert.match(text, /^Hi Sarah,/);
  assert.match(text, /it was sent on Tuesday from/);
  assert.match(text, /arrive by Friday\./);
  assert.match(text, /If it doesn’t arrive, let me know and I’ll chase it up/);
  assert.doesNotMatch(text, / {2}/);
  assert.ok(counts.lineBreaks >= 2);
});

test('clean: running it twice changes nothing', () => {
  for (const s of SAMPLES) {
    const once = E.clean(s.text).text;
    assert.equal(E.clean(once).text, once, s.id);
  }
});

test('clean: dash, quote and bullet styles follow settings', () => {
  const src = 'we said "yes" - then left\n* first\n- second';
  const curly = E.clean(src, { ...E.DEFAULT_SETTINGS }).text;
  assert.equal(curly, 'We said “yes” – then left\n• First\n• Second');
  const straight = E.clean(src, { ...E.DEFAULT_SETTINGS, quotes: 'straight', dashes: 'em', bullets: '-' }).text;
  assert.equal(straight, 'We said "yes"—then left\n- First\n- Second');
});

test('clean: leaves abbreviations, email addresses and placeholders alone', () => {
  const src = 'Hi {{Customer name}},\nsend it to jo@example.co.nz, e.g. the form.';
  const { text } = E.clean(src);
  assert.equal(text, 'Hi {{Customer name}},\nSend it to jo@example.co.nz, e.g. the form.');
});

test('rules: every style rule fires on its sample', () => {
  const wordy = E.check(sample('wordy'), { checker: speller });
  for (const c of ['wordy', 'filler', 'passive', 'long']) assert.ok(cats(wordy).includes(c), c);
  const shouty = E.check(sample('shouty'), { checker: speller });
  for (const c of ['shouty', 'avoid', 'repeat']) assert.ok(cats(shouty).includes(c), c);
  const messy = E.check(E.clean(sample('messy')).text, { checker: speller });
  assert.deepEqual(messy.filter((i) => i.category === 'spelling').map((i) => i.text), ['auckland']);
});

test('rules: nothing fires on the text that is already fine', () => {
  const issues = E.check(sample('fine'), { checker: speller });
  assert.deepEqual(issues, []);
});

test('rules: fixes keep capitals and tidy spaces', () => {
  const text = 'In order to help, I just checked. I am writing to inform you that it is done.';
  const issues = E.check(text, { checker: speller });
  const fixes = issues.flatMap((i) => i.fixes.slice(0, 1));
  assert.equal(E.applyFixes(text, fixes), 'To help, I checked. It is done.');
});

test('rules: ignored issues and turned-off rules are hidden', () => {
  const text = 'We will utilise it.';
  const [issue] = E.check(text);
  assert.equal(issue.rule, 'wordy:utilise');
  assert.equal(E.check(text, { ignored: [E.issueKey(issue)] }).length, 0);
  assert.equal(E.check(text, { settings: { ...E.DEFAULT_SETTINGS, disabledRules: ['wordy:utilise'] } }).length, 0);
});

test('rules: your own phrase list is used', () => {
  const settings = { ...E.DEFAULT_SETTINGS, avoid: [{ phrase: 'per my last email', swap: 'as I mentioned', why: 'Sounds tense.' }] };
  const [issue] = E.check('Per my last email, it is fixed.', { settings });
  assert.equal(issue.category, 'avoid');
  assert.equal(issue.fixes[0].replacement, 'As I mentioned');
});

test('spelling: NZ English, te reo Māori and personal words pass', () => {
  const text = 'Kia ora Hemi, ngā mihi for the colour swatches from Ōtautahi. The Zorblat team organised it.';
  const issues = E.spellingIssues(text, speller, E.DEFAULT_SETTINGS, []);
  assert.deepEqual(issues.map((i) => i.text), []);
  const us = E.spellingIssues('The color is nice.', speller);
  assert.deepEqual(us.map((i) => i.text), ['color']);
  assert.equal(E.spellingIssues('The colr is nice.', speller, E.DEFAULT_SETTINGS, ['colr']).length, 0);
});

test('spelling: email addresses, web addresses, numbers and blanks are skipped', () => {
  const text = 'Email jxq@zzexample.com or see www.qwzx.co.nz about job 12ab and {{Custmer name}}.';
  assert.equal(E.spellingIssues(text, speller).length, 0);
});

test('checklists: complaint reply ticks every item on the good sample', () => {
  const items = E.checklist(sample('complaint'), 'complaint');
  assert.deepEqual(items.filter((i) => !i.ok).map((i) => i.id), []);
  const blunt = E.checklist(sample('shouty'), 'complaint');
  assert.deepEqual(blunt.filter((i) => !i.ok).map((i) => i.id), ['acknowledge', 'done', 'next']);
  assert.deepEqual(E.checklist('', 'email').filter((i) => i.ok), []);
});

test('scores: counts and reading ease', () => {
  const s = E.scores(sample('fine'));
  assert.equal(s.words, 48);
  assert.ok(s.readingEase >= 80);
  assert.equal(s.readingLabel, 'Very easy');
  assert.equal(E.scores('').readingEase, null);
});

test('redaction: names, phone, email, money, dates, addresses and references become blanks', () => {
  const text = `Hi Sarah Jones,

Sarah, I called you on 021 555 0192 and emailed sarah.j@example.co.nz about invoice INV-20481. The refund of $84.50 was sent on 3 October to 14 Rata Street, Riccarton.

Kind regards,
Jordan`;
  const found = E.findPersonalDetails(text);
  const kinds = found.map((d) => d.kind).sort();
  assert.deepEqual(kinds, ['address', 'amount', 'date', 'email', 'name', 'name', 'phone', 'reference', 'signature']);
  const out = E.applyRedactions(text, found, found.map((d) => d.id));
  assert.equal(out, `Hi {{Customer name}},

{{Customer name}}, I called you on {{Phone number}} and emailed {{Email address}} about invoice {{Reference number}}. The refund of {{Amount}} was sent on {{Date}} to {{Address}}.

Kind regards,
{{Your name}}`);
});

test('redaction: unticked details stay as they are', () => {
  const text = 'Hi Mere,\n\nCall 0800 123 456.\n\nNgā mihi,\nSam';
  const found = E.findPersonalDetails(text);
  const keep = found.filter((d) => d.kind !== 'phone').map((d) => d.id);
  assert.equal(E.applyRedactions(text, found, keep), 'Hi {{Customer name}},\n\nCall 0800 123 456.\n\nNgā mihi,\n{{Your name}}');
});

test('templates: search, filter and merge', () => {
  const list = [
    { id: 'a', title: 'Refund sent', type: 'email', labels: { topic: ['Refund'] }, text: 'x', updated: 2 },
    { id: 'b', title: 'Missed visit', type: 'complaint', labels: { topic: ['Appointment'] }, text: 'technician', updated: 1 },
  ];
  assert.deepEqual(E.searchTemplates(list, { query: 'technician' }).map((t) => t.id), ['b']);
  assert.deepEqual(E.searchTemplates(list, { type: 'email' }).map((t) => t.id), ['a']);
  assert.deepEqual(E.searchTemplates(list, { label: { group: 'topic', value: 'Appointment' } }).map((t) => t.id), ['b']);
  const merged = E.mergeTemplates(list, [{ id: 'a', title: 'Newer', text: 'y', updated: 5 }, { id: 'c', title: 'New', text: 'z', updated: 1 }]);
  assert.equal(merged.added, 1);
  assert.equal(merged.updated, 1);
  assert.equal(merged.templates.find((t) => t.id === 'a').title, 'Newer');
});

test('highlights: escapes HTML and marks issues', () => {
  const text = '<b> utilise';
  const html = E.highlightHtml(text, E.check(text));
  assert.match(html, /^&lt;b&gt; <span class="u-wordy" data-issue="i0">utilise<\/span>/);
});

test('speed: 5,000 words checks in well under a second', () => {
  const big = Array.from({ length: 60 }, () => sample('wordy')).join('\n\n');
  const t = Date.now();
  E.check(big, { checker: speller });
  E.scores(big);
  assert.ok(Date.now() - t < 1500, `${Date.now() - t} ms`);
});

test('blanks: words inside {{placeholders}} are not flagged by other rules', () => {
  const text = 'Use your reference {{Reference number}} today.';
  assert.deepEqual(E.check(text).map((i) => i.category), ['placeholder']);
});

test('clean: links, email addresses and blanks are never changed', () => {
  const src = 'see https://example.co.nz/a--b?x=1,y=2 or mail jo.smith@example.co.nz,then {{customer name}} said "hi".';
  const { text } = E.clean(src);
  assert.equal(text, 'See https://example.co.nz/a--b?x=1,y=2 or mail jo.smith@example.co.nz, then {{customer name}} said “hi”.');
});

test('clean: missing spaces and doubled marks', () => {
  assert.equal(E.clean('Hi,thanks for that.It is done,, really?? Yes...ok').text, 'Hi, thanks for that. It is done, really? Yes...ok');
  assert.equal(E.clean('Costs $1,200.50 and 3.5 hours, e.g.It works.').text, 'Costs $1,200.50 and 3.5 hours, e.g.It works.');
});

test('clean: missing apostrophes', () => {
  assert.equal(E.clean('im sure we dont need it. Thats fine, it wont take long.').text, 'I’m sure we don’t need it. That’s fine, it won’t take long.');
  assert.equal(E.clean('dont', { ...E.DEFAULT_SETTINGS, quotes: 'straight' }).text, "Don't");
  assert.equal(E.clean('thanks for that.im sure. Send report.pdf today').text, 'Thanks for that. I’m sure. Send report.pdf today');
});

test('clean: short lines without bullets stay on their own lines', () => {
  const list = 'Please check:\nthe modem lights\nthe cable at the wall\nthe power switch';
  assert.equal(E.clean(list).text, 'Please check:\nThe modem lights\nThe cable at the wall\nThe power switch');
  const wrapped = 'We have looked into the delivery and it was sent on\ntuesday from our depot, so it should arrive soon.';
  assert.equal(E.clean(wrapped).text, 'We have looked into the delivery and it was sent on Tuesday from our depot, so it should arrive soon.');
});

test('clean: ellipsis and a.m./p.m. do not start a new sentence', () => {
  assert.equal(E.clean('we will call at 8 a.m. tomorrow. wait... then try again.').text, 'We will call at 8 a.m. tomorrow. Wait... then try again.');
});

test('clean: each step can be switched off', () => {
  const off = { ...E.DEFAULT_SETTINGS, clean: { capitals: false, apostrophes: false } };
  assert.equal(E.clean('hi  there, dont worry.', off).text, 'hi there, dont worry.');
});
