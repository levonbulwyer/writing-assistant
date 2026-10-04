// Browser walk-through of every feature. Run with `npm run e2e`.
// Opens dist/writing-assistant.html from disk, clicks through the app and fails on any
// network request, console error or broken step. Screenshots go to ./screenshots.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = pathToFileURL(path.join(root, 'dist/writing-assistant.html')).href;
const shots = process.env.SHOTS || path.join(root, 'screenshots');
fs.mkdirSync(shots, { recursive: true });

const launchOptions = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
// Falls back to the installed Google Chrome if Playwright's own Chromium has not been downloaded
const browser = await chromium.launch(launchOptions).catch(() => chromium.launch({ channel: 'chrome' }));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

const requests = [];
const errors = [];
page.on('request', (r) => { if (r.url() !== file && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const step = async (name, fn) => {
  process.stdout.write(`• ${name} … `);
  await fn();
  console.log('ok');
};
const shot = (name) => page.screenshot({ path: path.join(shots, name + '.png') });
const editor = page.locator('#editor');
const setText = async (text) => { await editor.fill(text); await page.waitForTimeout(250); };
const toastText = async () => (await page.locator('#toast').textContent()).trim();

await page.goto(file);
await page.waitForFunction(() => document.querySelector('#dict-status').textContent.includes('New Zealand'), null, { timeout: 15000 });

await step('opens with the wordy sample and finds issues', async () => {
  await page.waitForTimeout(400);
  const n = Number(await page.locator('#issue-count').textContent());
  assert.ok(n > 10, `expected issues, got ${n}`);
  assert.equal(await page.locator('#sample-badge').isVisible(), true);
  await shot('01-first-open');
});

await step('highlights line up with the text', async () => {
  const off = await page.evaluate(() => {
    const ta = document.querySelector('#editor');
    const bd = document.querySelector('#backdrop');
    return { ta: ta.getBoundingClientRect().width, bd: bd.getBoundingClientRect().width, taH: ta.scrollHeight, bdH: bd.scrollHeight };
  });
  assert.ok(Math.abs(off.ta - off.bd) < 1, JSON.stringify(off));
  assert.ok(Math.abs(off.taH - off.bdH) < 30, JSON.stringify(off));
});

await step('clicking an issue selects it in the text', async () => {
  await page.locator('.issue', { hasText: 'utilise' }).first().click();
  const sel = await page.evaluate(() => { const t = document.querySelector('#editor'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  assert.equal(sel, 'utilise');
  await shot('02-issue-selected');
});

await step('applying a fix changes the text and moves on', async () => {
  await page.locator('.issue.active .fix').first().click();
  await page.waitForTimeout(300);
  assert.match(await editor.inputValue(), /need to use the information/);
});

await step('undo puts it back', async () => {
  await page.click('#btn-undo');
  await page.waitForTimeout(250);
  assert.match(await editor.inputValue(), /need to utilise the information/);
});

await step('Fix Simple applies every simple fix at once', async () => {
  await page.locator('[data-act="fix-all"]').click();
  await page.waitForTimeout(300);
  const v = await editor.inputValue();
  assert.doesNotMatch(v, /in order to|utilise|basically|due to the fact/i);
  assert.match(await toastText(), /Applied \d+ fixes/);
  await shot('03-after-fix-all');
});

await step('auto-clean tidies a messy paste', async () => {
  await page.selectOption('#sample-select', 'messy');
  await page.waitForTimeout(300);
  await page.click('#btn-clean');
  await page.waitForTimeout(300);
  const v = await editor.inputValue();
  assert.match(v, /^Hi Sarah,/);
  assert.match(v, /sent on Tuesday from/);
  assert.match(await toastText(), /^Fixed/);
  await page.click('#btn-undo');
  await page.waitForTimeout(200);
  assert.match(await editor.inputValue(), /^hi Sarah,/);
  await page.click('#btn-clean');
  await page.waitForTimeout(200);
});

await step('Clean shows what changed and Undo in the toast works', async () => {
  await setText('hi  there,thanks for that.im sure it wont take long');
  await page.click('#btn-clean');
  await page.waitForTimeout(150);
  assert.ok(await page.locator('#backdrop .bg-flash').count() >= 3, 'changed words are tinted');
  assert.equal(await editor.inputValue(), 'Hi there, thanks for that. I’m sure it won’t take long');
  await shot('03b-clean-flash');
  await page.locator('#toast button', { hasText: 'Undo' }).click();
  await page.waitForTimeout(200);
  assert.equal(await editor.inputValue(), 'hi  there,thanks for that.im sure it wont take long');
});

await step('Clean switches and Clean when I paste', async () => {
  await page.click('#btn-settings');
  await page.waitForSelector('#settings-sheet[open]');
  await page.locator('[data-clean="capitals"]').uncheck({ force: true });
  await page.locator('[data-flag="cleanOnPaste"]').check({ force: true });
  await page.click('#settings-sheet [data-close]');
  await setText('');
  await editor.focus();
  await page.evaluate(() => {
    const ta = document.querySelector('#editor');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'pasted  text,dont');
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    document.execCommand('insertText', false, 'pasted  text,dont');
  });
  await page.waitForTimeout(300);
  assert.equal(await editor.inputValue(), 'pasted text, don’t');
  await page.click('#btn-settings');
  await page.locator('[data-clean="capitals"]').check({ force: true });
  await page.locator('[data-flag="cleanOnPaste"]').uncheck({ force: true });
  await page.click('#settings-sheet [data-close]');
  await page.selectOption('#sample-select', 'messy');
  await page.waitForTimeout(200);
  await page.click('#btn-clean');
  await page.waitForTimeout(200);
});

await step('spelling: suggestions and add to dictionary', async () => {
  await page.waitForSelector('.issue.tone-purple [data-fix]', { timeout: 5000 });
  assert.match(await editor.inputValue(), /doesn’t arrive/, 'Clean added the apostrophe');
  // A lower-case place name is a capital-letter issue, shown once and not as a spelling error
  const card = page.locator('.issue', { hasText: 'auckland' }).first();
  await card.click();
  await page.waitForSelector('.issue.active [data-fix="0"]');
  assert.equal((await page.locator('.issue.active [data-fix="0"]').textContent()).trim(), 'Change to “Auckland”');
  assert.equal(await page.locator('.issue.tone-red', { hasText: 'auckland' }).count(), 0);
  await setText('Please ask about the zorptax today.');
  await page.waitForSelector('.issue.tone-red:has-text("zorptax")', { timeout: 5000 });
  const word = page.locator('.issue.tone-red', { hasText: 'zorptax' }).first();
  await word.click();
  await word.locator('[data-act="add-word"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.issue', { hasText: 'zorptax' }).count(), 0);
});

await step('checklist ticks itself for a complaint reply', async () => {
  await page.selectOption('#sample-select', 'complaint');
  await page.waitForTimeout(300);
  await page.click('#panel-control [data-panel="checklist"]');
  assert.equal((await page.locator('#check-count').textContent()).trim(), '6/6');
  await setText('Hi Mere,\n\nYour visit is moved.');
  assert.equal((await page.locator('#check-count').textContent()).trim(), '1/6');
  await shot('04-checklist');
  await page.selectOption('#sample-select', 'complaint');
  await page.waitForTimeout(250);
});

await step('stats show reading ease and the longest sentence', async () => {
  await page.click('#panel-control [data-panel="stats"]');
  assert.match(await page.locator('#panel-stats').textContent(), /Reading ease\s*\d+/);
  await page.locator('#panel-stats [data-act="longest"]').click();
  const sel = await page.evaluate(() => { const t = document.querySelector('#editor'); return t.selectionEnd - t.selectionStart; });
  assert.ok(sel > 50);
  await shot('05-stats');
  await page.click('#panel-control [data-panel="issues"]');
});

await step('Mark as Perfect blanks out personal details', async () => {
  await page.click('#btn-save');
  await page.waitForSelector('#save-sheet[open]');
  const tpl = await page.locator('#tpl-text').inputValue();
  assert.match(tpl, /^Kia ora \{\{Customer name\}\},/);
  assert.match(tpl, /I’m sorry/, 'text is cleaned before saving');
  await page.locator('#tpl-tidy').uncheck({ force: true });
  assert.match(await page.locator('#tpl-text').inputValue(), /I'm sorry/);
  await page.locator('#tpl-tidy').check({ force: true });
  assert.match(tpl, /\{\{Your name\}\}$/);
  assert.match(tpl, /\{\{Date\}\}/);
  await page.locator('#tpl-labels [data-group="topic"] [data-label="Appointment"]').click();
  await page.locator('#tpl-labels [data-group="situation"] [data-new]').click();
  await page.keyboard.type('Missed visit');
  await page.keyboard.press('Enter');
  await page.fill('#tpl-title', 'Missed visit, rebooked');
  await page.fill('#tpl-note', 'Short apology, clear new time.');
  await page.waitForTimeout(300);
  await shot('06-save-sheet');
  // Untick the date so it stays in the template
  await page.locator('#redact-list input').filter({ has: page.locator('xpath=..') }).nth(1).uncheck();
  assert.match(await page.locator('#tpl-text').inputValue(), /Thursday 9 October/);
  await page.locator('#redact-list input').nth(1).check();
  await page.click('#save-confirm');
  await page.waitForTimeout(300);
  assert.match(await toastText(), /Saved “Missed visit, rebooked”/);
});

await step('library: filter by label, search and use a template', async () => {
  await page.click('#btn-library');
  await page.waitForSelector('#library-sheet[open]');
  assert.ok(await page.locator('.lib-item').count() >= 4);
  await page.locator('.side-item', { hasText: 'Missed visit' }).click();
  assert.equal(await page.locator('.lib-item').count(), 1);
  await page.waitForTimeout(300);
  await shot('07-library');
  await page.locator('.side-item', { hasText: 'All Templates' }).click();
  await page.fill('#lib-search', 'refund');
  assert.equal(await page.locator('.lib-item').count(), 1);
  await page.locator('.lib-item').first().click();
  await page.locator('[data-act="use"]').click();
  await page.locator('[data-act="use-replace"]').click();
  await page.waitForTimeout(300);
  const v = await editor.inputValue();
  assert.match(v, /^Hi \{\{Customer name\}\},/);
  const sel = await page.evaluate(() => { const t = document.querySelector('#editor'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  assert.equal(sel, '{{Customer name}}');
  await page.keyboard.type('Aroha');
  await page.keyboard.press('Tab');
  const sel2 = await page.evaluate(() => { const t = document.querySelector('#editor'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  assert.equal(sel2, '{{Amount}}');
  assert.equal(await page.locator('.issue.tone-orange', { hasText: 'Reference' }).count(), 0, 'words inside blanks are not flagged');
  await shot('08-template-in-use');
});

await step('library: edit and delete', async () => {
  await page.click('#btn-library');
  await page.fill('#lib-search', '');
  await page.locator('.lib-item', { hasText: 'Request declined' }).click();
  await page.locator('[data-act="edit"]').click();
  await page.fill('#edit-title', 'Request declined, offer another way');
  await page.locator('[data-act="save-edit"]').click();
  assert.equal(await page.locator('.lib-detail h3').textContent(), 'Request declined, offer another way');
  await page.locator('[data-act="delete"]').click();
  assert.match(await page.locator('[data-act="delete"]').textContent(), /Confirm Delete/);
  await page.locator('[data-act="delete"]').click();
  assert.equal(await page.locator('.lib-item', { hasText: 'Request declined' }).count(), 0);
});

let backupPath;
await step('export and import a backup', async () => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#library-sheet [data-action="export"]').click()]);
  backupPath = path.join(shots, 'backup.json');
  await download.saveAs(backupPath);
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(data.app, 'writing-assistant');
  assert.ok(data.templates.some((t) => t.title === 'Missed visit, rebooked'));
  assert.ok(data.dictionary.includes('zorptax'));
  // Wipe the library, then import
  await page.evaluate(() => { localStorage.setItem('wa.v1.templates', '[]'); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#dict-status').textContent.includes('New Zealand'));
  await page.click('#btn-library');
  assert.equal(await page.locator('.lib-item').count(), 0);
  await page.setInputFiles('#import-file', backupPath);
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.lib-item').count() >= 3);
  assert.match(await toastText(), /Imported/);
  await page.click('#library-sheet [data-close]');
});

await step('settings: phrase list, rules and clean-up style', async () => {
  await page.click('#btn-settings');
  await page.waitForSelector('#settings-sheet[open]');
  await page.waitForTimeout(400);
  await shot('09-settings');
  await page.click('[data-add-phrase]');
  const row = page.locator('#avoid-group .phrase-row[data-i]').last();
  await row.locator('[data-k="phrase"]').fill('per my last email');
  await row.locator('[data-k="phrase"]').press('Tab');
  await row.locator('[data-k="swap"]').fill('as I mentioned');
  await row.locator('[data-k="swap"]').press('Tab');
  await page.locator('[data-setting="quotes"] [data-value="straight"]').click();
  await page.click('#settings-sheet [data-close]');
  await setText('Per my last email, it’s done.');
  assert.ok(await page.locator('.issue', { hasText: 'Per my last email' }).count() === 1);
  await page.click('#btn-clean');
  await page.waitForTimeout(200);
  assert.equal(await editor.inputValue(), "Per my last email, it's done.");
  await page.locator('.issue', { hasText: 'Per my last email' }).click();
  await page.locator('.issue.active [data-act="rule-off"]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.issue', { hasText: 'Per my last email' }).count(), 0);
});

await step('copy puts the text on the clipboard', async () => {
  await setText('Hi {{Customer name}},\n\nThanks.');
  await page.click('#btn-copy');
  await page.waitForTimeout(200);
  assert.match(await toastText(), /1 blank still to fill in/);
});

await step('5,000-word paste stays quick', async () => {
  const big = Array.from({ length: 50 }, () => 'I am writing to inform you that the refund was processed by our team on a daily basis, and we are basically just waiting for the bank to confirm, which honestly could take a number of days due to the fact that banks are very slow at this point in time. Please do not hesitate to contact us.').join('\n\n');
  const t = Date.now();
  await editor.fill(big);
  await page.waitForFunction(() => Number(document.querySelector('#issue-count').textContent) > 500, null, { timeout: 10000 });
  const ms = Date.now() - t;
  assert.ok(ms < 3000, `${ms} ms`);
  console.log(`(${ms} ms) `);
});

await step('phone layout has no sideways scroll', async () => {
  await page.selectOption('#sample-select', 'wordy');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(wide <= 390, `page is ${wide}px wide`);
  await shot('10-phone');
  await page.setViewportSize({ width: 1440, height: 900 });
});

await step('commas, capitals and grammar: our rules, the small libraries and Harper', async () => {
  await page.waitForFunction(() => document.querySelector('#grammar-status').textContent.includes('ready'), null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelector('#panel-control [data-panel=\"issues\"]')?.click(); });
  await setText('hi john\n\nHowever I spoke to mr patel in auckland. It was a hour wait but we has fixed it.\n\nKind regards\nalex');
  await page.waitForSelector('.issue.tone-green', { timeout: 8000 }); // Harper or the a/an check
  const chips = (await page.locator('.chips .chip').allTextContents()).join(' ');
  for (const name of ['Punctuation', 'Capital letters', 'Grammar']) assert.match(chips, new RegExp(name), name);
  const text = await page.locator('#panel-issues').textContent();
  assert.match(text, /comma after “However”/i);
  assert.match(text, /“Auckland” takes a capital/);
  await page.click('[data-act="fix-all"]');
  await page.waitForTimeout(400);
  const fixed = await editor.inputValue();
  assert.match(fixed, /^Hi John,/);
  assert.match(fixed, /However, I spoke to Mr Patel in Auckland/);
  assert.match(fixed, /Kind regards,\nAlex/);
});

await step('no network requests and no errors', async () => {
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});

await browser.close();
console.log(`\nAll steps passed. Screenshots in ${path.relative(process.cwd(), shots) || '.'}`);
