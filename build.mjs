// Builds dist/writing-assistant.html: one self-contained file with the styles, the code and
// the New Zealand English dictionary inside it. Open that file in any browser; it needs no internet.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.dirname(new URL(import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const result = await build({
  entryPoints: [path.join(root, 'src/app.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome90', 'edge90', 'firefox90', 'safari14'],
  write: false,
  legalComments: 'inline',
  charset: 'utf8',
});
const js = result.outputFiles[0].text;

const aff = read('node_modules/dictionary-en-gb/index.aff');
const dic = read('node_modules/dictionary-en-gb/index.dic');
for (const [name, text] of [['js', js], ['aff', aff], ['dic', dic]]) {
  if (/<\/script/i.test(text)) throw new Error(`${name} contains </script and cannot be inlined`);
}

const html = read('src/index.html')
  .replace('/*__CSS__*/', () => read('src/styles.css'))
  .replace('/*__AFF__*/', () => aff)
  .replace('/*__DIC__*/', () => dic)
  .replace('/*__JS__*/', () => js);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/writing-assistant.html');
fs.writeFileSync(out, html);
console.log(`Built ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KB)`);
