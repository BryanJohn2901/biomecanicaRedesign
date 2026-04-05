#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const DIST_CSS = path.join(DIST, 'css');
const DIST_JS = path.join(DIST, 'js');
const DIST_ASSETS = path.join(DIST, 'assets');
const SOURCE_HTML = path.join(ROOT, 'index.html');
const CANONICAL_URL = 'https://pos.personaltraineracademy.com.br/';
const THANK_YOU_URL = 'https://pos.personaltraineracademy.com.br/obg-obrigado-tf/';

function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST_CSS, { recursive: true });
  fs.mkdirSync(DIST_JS, { recursive: true });
  fs.mkdirSync(DIST_ASSETS, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((name) => {
      copyRecursive(path.join(src, name), path.join(dest, name));
    });
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function ensureSeoMeta(html) {
  let output = html;

  output = output.replace(
    /<link rel="canonical" href="[^"]*">/i,
    `<link rel="canonical" href="${CANONICAL_URL}">`
  );

  output = output.replace(
    /<meta property="og:url" content="[^"]*">/i,
    `<meta property="og:url" content="${CANONICAL_URL}">`
  );

  output = output.replace(
    /URL_DO_SEU_SITE\.com\.br/g,
    'pos.personaltraineracademy.com.br'
  );

  /* Garante og/twitter com caminho /assets/img/ em URLs absolutas legadas */
  output = output.replace(
    /https:\/\/pos\.personaltraineracademy\.com\.br\/img\//g,
    'https://pos.personaltraineracademy.com.br/assets/img/'
  );

  return output;
}

/** Performance: hints para CDNs e GTM (não duplicar) */
function ensurePreconnect(html) {
  if (html.includes('href="https://cdnjs.cloudflare.com"')) return html;
  const inject = `    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="dns-prefetch" href="https://www.googletagmanager.com">
    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
    <link rel="preconnect" href="https://unpkg.com" crossorigin>
`;
  return html.replace(/<meta charset="UTF-8">/i, '<meta charset="UTF-8">\n' + inject);
}

function extractInlineStyle(html) {
  const styleRegex = /<style>([\s\S]*?)<\/style>/i;
  const match = html.match(styleRegex);
  if (!match) return { html, css: '' };
  const css = match[1] || '';
  const updatedHtml = html.replace(styleRegex, '');
  return { html: updatedHtml, css };
}

function extractInlineScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) return { html, js: '' };
  const last = scripts[scripts.length - 1];
  const js = last[1] || '';
  const wholeTag = last[0];
  const updatedHtml = html.replace(wholeTag, '<script src="js/main.min.js" defer></script>');
  return { html: updatedHtml, js };
}

function rewritePaths(html) {
  let output = html;
  output = output.replace(/src="img\//g, 'src="assets/img/');
  output = output.replace(/href="img\//g, 'href="assets/img/');
  output = output.replace(/url\(img\//g, 'url(assets/img/');
  output = output.replace(/href="favicon\.ico"/g, 'href="assets/favicon.ico"');
  return output;
}

function forceThankYouRedirect(jsCode) {
  return jsCode
    .replace(/const\s+REDIRECT_URL_VERDE\s*=\s*['"][^'"]*['"];/g, `const REDIRECT_URL_VERDE = '${THANK_YOU_URL}';`)
    .replace(/const\s+redirectUrl\s*=\s*['"][^'"]*['"];/g, `const redirectUrl = '${THANK_YOU_URL}';`);
}

async function build() {
  console.log('Limpando dist/...');
  cleanDist();

  console.log('Compilando CSS Tailwind...');
  execSync('npx tailwindcss -i ./src/input.css -o ./dist/css/style.raw.css --minify', {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log('Processando CSS...');
  let cssCode = fs.readFileSync(path.join(DIST_CSS, 'style.raw.css'), 'utf8');
  /* Tailwind preserva url(../img/...) vindo de src/input.css; assets reais ficam em dist/assets/img/ */
  cssCode = cssCode.replace(/url\(\.\.\/img\//g, 'url(../assets/img/');
  cssCode = cssCode.replace(/url\(img\//g, 'url(../assets/img/');
  const cssMinified = new CleanCSS({ level: 2 }).minify(cssCode).styles;
  fs.writeFileSync(path.join(DIST_CSS, 'style.css'), cssMinified, 'utf8');
  fs.rmSync(path.join(DIST_CSS, 'style.raw.css'), { force: true });

  console.log('Copiando assets...');
  copyRecursive(path.join(ROOT, 'img'), path.join(DIST_ASSETS, 'img'));
  if (fs.existsSync(path.join(ROOT, 'favicon.ico'))) {
    copyRecursive(path.join(ROOT, 'favicon.ico'), path.join(DIST_ASSETS, 'favicon.ico'));
  }

  console.log('Processando HTML/JS...');
  let html = fs.readFileSync(SOURCE_HTML, 'utf8');
  html = ensurePreconnect(html);
  html = ensureSeoMeta(html);
  html = rewritePaths(html);

  const styleParts = extractInlineStyle(html);
  html = styleParts.html;
  const inlineCss = styleParts.css || '';

  const scriptParts = extractInlineScript(html);
  html = scriptParts.html;
  let inlineJs = scriptParts.js || '';
  inlineJs = forceThankYouRedirect(inlineJs);

  if (inlineCss.trim()) {
    const inlineCssMin = new CleanCSS({ level: 2 }).minify(inlineCss).styles;
    fs.writeFileSync(path.join(DIST_CSS, 'inline.css'), inlineCssMin, 'utf8');
    html = html.replace('</head>', '    <link rel="stylesheet" href="css/inline.css">\n</head>');
  }

  const jsResult = await minifyJs(inlineJs, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  fs.writeFileSync(path.join(DIST_JS, 'main.min.js'), jsResult.code || '', 'utf8');

  const htmlMinified = await minifyHtml(html, {
    collapseWhitespace: true,
    /* Preserva comentários HTML do GTM e estrutura de terceiros */
    removeComments: false,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: false,
    useShortDoctype: true,
  });
  fs.writeFileSync(path.join(DIST, 'index.html'), htmlMinified, 'utf8');

  if (fs.existsSync(path.join(ROOT, '.htaccess'))) {
    copyRecursive(path.join(ROOT, '.htaccess'), path.join(DIST, '.htaccess'));
  }

  console.log('Build finalizado com sucesso em dist/.');
}

build().catch((err) => {
  console.error('Falha no build:', err);
  process.exit(1);
});
