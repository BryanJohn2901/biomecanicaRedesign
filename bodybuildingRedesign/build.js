#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build estático: dist/index.html | dist/css/style.css | dist/js/main.min.js | dist/assets/
 * Substitui Tailwind CDN por CSS compilado (purge via tailwind.config.js).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const CANONICAL_URL = 'https://pos.personaltraineracademy.com.br/';
const OG_IMAGE_URL =
  'https://pos.personaltraineracademy.com.br/assets/bgHero-DEdxdqbG.webp';

const RE_GTM_HEAD =
  /<script>\(function\(w,d,s,l,i\)\{[\s\S]*?<\/script>/;

function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'css'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

function stripProductionHtml(html) {
  let out = html;
  out = out.replace(/<link rel="preconnect" href="https:\/\/cdn\.tailwindcss\.com">\s*/gi, '');
  out = out.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/gi, '');
  out = out.replace(/<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?<\/script>\s*/i, '');
  out = out.replace(/<style>[\s\S]*?<\/style>\s*/i, '');
  out = out.replace(
    /<link href="https:\/\/unpkg\.com\/aos@2\.3\.1\/dist\/aos\.css" rel="stylesheet">/i,
    '<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">\n    <link rel="stylesheet" href="css/style.css">'
  );
  out = out.replace(/\.\/assets\//g, 'assets/');
  if (!out.includes('rel="canonical"')) {
    out = out.replace(
      /<meta property="og:locale"[^>]*>/i,
      `$&\n    <link rel="canonical" href="${CANONICAL_URL}">`
    );
  } else {
    out = out.replace(
      /<link rel="canonical" href="[^"]*">/i,
      `<link rel="canonical" href="${CANONICAL_URL}">`
    );
  }
  if (!/<meta\s+property=["']og:url["']/i.test(out)) {
    out = out.replace(
      /<link rel="canonical"[^>]*>/i,
      `$&\n    <meta property="og:url" content="${CANONICAL_URL}">`
    );
  } else {
    out = out.replace(
      /<meta\s+property=["']og:url["'][^>]*>/i,
      `<meta property="og:url" content="${CANONICAL_URL}">`
    );
  }
  if (!/<meta\s+property=["']og:image["']/i.test(out)) {
    out = out.replace(
      /<meta property="og:type"[^>]*>/i,
      `$&\n    <meta property="og:image" content="${OG_IMAGE_URL}">`
    );
  } else {
    out = out.replace(
      /<meta\s+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${OG_IMAGE_URL}">`
    );
  }
  const twTitle = 'Pós-Graduação em Bodybuilding e Estética Corporal | PTA';
  if (!/<meta\s+name=["']twitter:card["']/i.test(out)) {
    out = out.replace(
      /<meta property="og:image"[^>]*>/i,
      `$&
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${twTitle}">
    <meta name="twitter:description" content="Pós-graduação reconhecida pelo MEC. Metodologia prática, 18 meses. Personal Trainer Academy.">
    <meta name="twitter:image" content="${OG_IMAGE_URL}">`
    );
  }
  if (!out.includes('www.googletagmanager.com')) {
    out = out.replace(
      /<meta charset="UTF-8">/i,
      `<meta charset="UTF-8">
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">`
    );
  }
  return out;
}

function extractGtmAndAppScript(html) {
  const m = html.match(RE_GTM_HEAD);
  const gtm = m ? m[0] : null;
  let work = html;
  if (gtm) work = work.replace(RE_GTM_HEAD, '__GTM_HEAD__');

  const marker = '<script src="https://unpkg.com/aos@2.3.1/dist/aos.js" defer></script>';
  const mi = work.indexOf(marker);
  if (mi === -1) throw new Error('Script AOS não encontrado.');
  const after = work.slice(mi + marker.length);
  const scr = after.match(/^\s*<script>([\s\S]*?)<\/script>/);
  if (!scr) throw new Error('Script principal inline não encontrado após AOS.');
  const appJs = scr[1] || '';
  const fullTag = after.match(/^\s*<script>[\s\S]*?<\/script>/)[0];
  work =
    work.slice(0, mi + marker.length) +
    '\n    <script src="js/main.min.js" defer></script>' +
    work.slice(mi + marker.length + fullTag.length);

  return { html: work, gtm, appJs };
}

async function build() {
  console.log('[bodybuilding] Limpando dist/…');
  cleanDist();

  console.log('[bodybuilding] Tailwind + clean-css…');
  execSync('npx tailwindcss -i ./src/input.css -o ./dist/css/style.css --minify', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  let css = fs.readFileSync(path.join(DIST, 'css', 'style.css'), 'utf8');
  css = new CleanCSS({ level: 2 }).minify(css).styles;
  fs.writeFileSync(path.join(DIST, 'css', 'style.css'), css, 'utf8');

  console.log('[bodybuilding] Copiando assets/…');
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));

  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = stripProductionHtml(html);

  const parts = extractGtmAndAppScript(html);
  html = parts.html;

  const jsOut = await minifyJs(parts.appJs, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  fs.writeFileSync(path.join(DIST, 'js', 'main.min.js'), jsOut.code || '', 'utf8');

  let safe = html;
  if (parts.gtm) safe = safe.replace('__GTM_HEAD__', parts.gtm);

  const htmlMin = await minifyHtml(safe, {
    collapseWhitespace: true,
    removeComments: false,
    removeRedundantAttributes: true,
    minifyCSS: false,
    minifyJS: false,
    useShortDoctype: true,
    keepClosingSlash: true,
  });

  fs.writeFileSync(path.join(DIST, 'index.html'), htmlMin, 'utf8');
  console.log('[bodybuilding] Concluído:', DIST);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
