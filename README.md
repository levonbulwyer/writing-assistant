# Writing Assistant

A writing checker for work email that uses rules, not AI. It is one HTML file: open `dist/writing-assistant.html` in any browser and it works with no internet connection and no install.

The page blocks every network connection (a Content Security Policy in the file), so nothing you type can leave it.

## What it does

| Part | What you get |
|---|---|
| **Clean** | One click fixes double spaces, lines broken by pasting from email or PDF, quote marks, dashes, bullets, capital letters after full stops, the word "I", and day and month names. **Undo** brings the original back. |
| **Issues** | Underlines in the text with a reason beside each: filler words, wordy phrases with plain swaps, passive voice, sentences over 25 words, repeated words, capitals and extra exclamation marks, and your own list of phrases to avoid. Most have a one-click fix. **Fix Simple** applies every easy fix at once. |
| **Spelling** | New Zealand English (the en-GB "-ise" Hunspell dictionary) plus common te reo Māori words. Suggestions, and **Add to Dictionary** for names and product terms. |
| **Checklist** | Choose **Email** or **Complaint reply** and it ticks off greeting, acknowledgement, what was done, next step, deadline and sign-off as you type. |
| **Stats** | Words, sentences, average sentence length, reading ease (Flesch) with a plain-English label, and a jump to the longest sentence. |
| **Mark as Perfect** | Saves the message as a template. Names, phone numbers, email addresses, amounts, dates, street addresses and reference numbers become blanks such as `{{Customer name}}`, which you can untick before saving. Add labels (topic, situation, tone, or your own) and a note on why it works. |
| **Templates** | A library to filter by type or label, search, edit and delete. **Use Template** puts it in the draft and selects the first blank; **Tab** jumps to the next one. |
| **Backup** | Templates, settings and your dictionary live in the browser. **Export Backup** saves them to a file; **Import** merges a backup back in. |

## Using it

1. Open `dist/writing-assistant.html` (double-click it, or drag it into a browser window).
2. Paste a message into the draft, choose the message type at the top, and work through the issues on the right.
3. When a message is right, choose **Mark as Perfect** to keep it as a template.

Export a backup now and then. Clearing browser data removes saved templates.

## Working on it

```bash
npm install
npm test          # engine tests (rules, clean-up, spelling, checklists, redaction)
npm run build     # writes dist/writing-assistant.html
npm run e2e       # opens the built file in Chromium and clicks through every feature
npm run check     # all three
```

Word lists, sample texts, example templates and label choices are all in `src/rules.js`. Change a list there and run `npm run build`. Phrases to avoid can also be edited inside the app under **Settings**, with no rebuild.

| File | Holds |
|---|---|
| `src/rules.js` | Every word list, the samples and the example templates |
| `src/engine.js` | The checking engine: pure functions, no page or storage code |
| `src/app.js` | The interface |
| `src/styles.css` | The look (light, Apple style) |
| `src/index.html` | The page skeleton and the no-network policy |
| `build.mjs` | Bundles everything, including the dictionary, into one file |
| `test/` | `engine.test.mjs` (Node tests) and `e2e.mjs` (browser walk-through) |
| `ROADMAP.md` | Every roadmap item, with how to test it |

## Credits

Spelling uses [nspell](https://github.com/wooorm/nspell) (MIT) with the en-GB dictionary from [dictionary-en-gb](https://github.com/wooorm/dictionaries) (MIT and BSD, derived from SCOWL). Both are bundled into the built file.
