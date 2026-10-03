# Roadmap and test guide

Everything on the roadmap is built. Use this list to demo and test it: each item says how to try it in the app. `npm run e2e` runs most of these automatically.

## 1. Scope and ground rules
- [x] Message types: **General**, **Email**, **Complaint reply** (segmented control at the top).
- [x] No network: `src/index.html` sets `default-src 'none'`. Test: open the built file, open DevTools → Network, use every feature. Only the file itself loads.
- [x] Five sample texts in `src/rules.js`: messy, wordy, complaint, blunt, already fine. Pick them from **Try a sample**.
- [x] One file: all word lists in `src/rules.js`, built into `dist/writing-assistant.html`.

## 2. Page shell
- [x] Two panes: draft on the left, issues on the right. Test: resize below 960px and they stack.
- [x] Live word count in the strip under the draft.
- [x] **Copy** button. Test: with a template blank left, the toast says how many blanks remain.
- [x] Opens straight from a folder (`file://`). Test: double-click the built file.

## 3. Auto-clean
- [x] Double spaces, trailing spaces, space before commas.
- [x] Rejoins lines broken by pasting. Test: sample **Messy paste** → **Clean**.
- [x] Quote style (Settings → Clean-up: curly, straight, leave).
- [x] Dash style (spaced en dash, em dash, leave) and bullet style (•, –, -).
- [x] Capitals after full stops, at line starts, the word I, days and months. Abbreviations like "e.g." are left alone.
- [x] **Undo**. Test: Clean, then Undo; the original comes back.

## 4. Rules engine (first usable version)
- [x] Sentence and word splitting that keeps character positions (`words`, `sentences` in `src/engine.js`).
- [x] Rules as plain data: phrase, swap, reason (`src/rules.js`).
- [x] Runner returns issues with start and end positions (`check`).
- [x] Highlight layer behind the text box. Test: underlines line up with words while typing and scrolling.
- [x] Click an issue to jump to it; click a word in the text to open its issue. **Apply fix** moves to the next issue.
- [x] **Ignore** (this wording) and **Turn Off Rule**. Both can be undone in Settings → Turned off and ignored.

## 5. Style rules
- [x] Filler words, wordy phrases with swaps, sentences over 25 words (adjustable), passive voice, repeated words, ALL CAPS and extra exclamation marks.
- [x] Your workplace phrase list. Test: Settings → Your phrase list → Add Phrase, then type it in the draft.
- [x] Every rule fires on its sample and none fires on **Already fine** (`npm test` checks this).

## 6. Spelling in NZ English
- [x] en-GB "-ise" Hunspell dictionary, bundled (about 550 KB).
- [x] Red wavy underline with up to three suggestions.
- [x] Personal dictionary. Test: **Add to Dictionary** on a name; manage it in Settings.
- [x] Skips email addresses, web addresses, numbers, acronyms, blanks, and capitalised names mid-sentence (switch in Settings).
- [x] Common te reo Māori words (kia ora, ngā mihi, whānau…) are known.

## 7. Message checklists
- [x] Complaint reply: greeting, acknowledgement, what was done, next step, deadline, sign-off.
- [x] Email: greeting, clear ask, deadline, sign-off.
- [x] Ticks update as you type. Test: sample **Complaint reply** shows 6/6; delete the sign-off and it drops to 5/6.

## 8. Scores
- [x] Words, sentences, average sentence length, characters, reading time.
- [x] Reading ease (Flesch) with a label; 60 or more is plain English.
- [x] Longest sentence: click it in the strip or Stats to select it.

## 9. Hardening
- [x] False alarms checked against all five samples (`npm test`).
- [x] 5,000-word paste checks in about a third of a second (`npm run e2e`).
- [x] All word lists in one file (`src/rules.js`).
- [x] Settings, dictionary, templates and draft saved in browser storage.
- [ ] Open it on the work computer and confirm it runs. **Needs you.**
- [x] Footer says it runs on this page only.

## 10. Template archiver
- [x] Storage: browser storage, with export and import as a backup file.
- [x] Labels: topic, situation and tone, plus **New** to add your own.
- [x] **Mark as Perfect** button in the toolbar.
- [x] Save sheet: title, message type, labels, and a "why it works" note.
- [x] Personal details become blanks: names (from the greeting, and everywhere else they appear), your name after the sign-off, phone numbers (NZ formats and 0800), email addresses, dollar amounts, dates, street addresses, reference numbers. Untick any to keep it.
- [x] Library: search, filter by message type or label.
- [x] **Use Template**: replace the draft or insert at the cursor; the first blank is selected and **Tab** / **Shift+Tab** move between blanks.
- [x] Edit, relabel and delete (delete asks to confirm).
- [x] Export and import the whole library.

## Parked ideas
- [ ] Phrase bank of approved sentences to click and insert.
- [ ] Tone check from word lists (too blunt, too soft).
- [ ] Save templates as files in a chosen folder (File System Access API, Chrome and Edge only).
