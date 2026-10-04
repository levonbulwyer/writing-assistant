import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { libraryIssues, carryOver } from '../src/extras.js';

const speller = { correct: (w) => !/^(auckland|john|zorptax)$/i.test(w) || /^john$/i.test(w) };

test('libraries: a/an and missing apostrophes', () => {
  const found = libraryIssues('It was a hour wait. They dont know.', { checker: speller });
  assert.ok(found.some((i) => i.rule === 'grammar:article' && i.fixes[0].replacement === 'an'));
  assert.ok(found.some((i) => i.rule === 'grammar:apostrophe' && i.fixes[0].replacement === "don't"));
});

test('libraries: tone words and ordinary pronouns are not flagged as insensitive', () => {
  const found = libraryIssues('He said it was basically just a quick call. She agreed.', { checker: speller });
  assert.deepEqual(found.filter((i) => i.category === 'inclusive'), []);
  assert.ok(libraryIssues('The chairman was dumb.', { checker: speller }).some((i) => i.category === 'inclusive'));
});

test('libraries: a lower-case place the dictionary does not know is a capital issue', () => {
  const found = libraryIssues('We drove to hamilton and then to auckland.', { checker: { correct: () => false } });
  assert.deepEqual(found.filter((i) => i.rule === 'capital:guess').map((i) => i.fixes[0].replacement), ['Hamilton', 'Auckland']);
  assert.deepEqual(libraryIssues('Ask bill about the will.', { checker: { correct: () => true } }).filter((i) => i.category === 'capital'), []);
});

test('libraries: results merge into check() without doubling up', () => {
  const text = 'We drove to auckland.';
  const issues = E.check(text, { checker: speller, extra: libraryIssues(text, { checker: speller }) });
  assert.equal(issues.filter((i) => i.start === 12).length, 1);
});

test('carryOver: keeps issues before an edit, moves those after it, drops those it touches', () => {
  const issue = (start, end) => ({ rule: 'x', category: 'grammar', start, end, text: '', fixes: [{ label: '', start, end, replacement: '' }] });
  const old = 'aaa bbb ccc';
  const got = carryOver(old, 'aaa bbbXX ccc', [issue(0, 3), issue(4, 7), issue(8, 11)]);
  assert.deepEqual(got.map((i) => [i.start, i.end]), [[0, 3], [10, 13]]);
  assert.deepEqual(got[1].fixes[0].start, 10);
});
