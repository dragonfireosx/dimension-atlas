// Bundles everything (three.js included) into one offline HTML file: dist/index.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const notices = readFileSync('node_modules/three/LICENSE', 'utf8').replace(/<\//g, '<\\/');
const out = await build({
  define: { __APP_VERSION__: JSON.stringify(version) },
  entryPoints: ['src/entry.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/style.css', 'utf8');
const html = readFileSync('src/index.template.html', 'utf8')
  .replace('/*CSS*/', () => css)
  .replace('/*NOTICES*/', () => `three.js\n\n${notices}`)
  .replace('/*JS*/', () => js);
writeFileSync('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
