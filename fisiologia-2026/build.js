/**
 * Build de produção estático (deploy direto).
 * Saídas obrigatórias:
 * - dist/index.html (HTML minificado)
 * - dist/css/style.css (CSS minificado)
 * - dist/js/main.js (JS minificado extraído do inline próprio)
 * - dist/assets/* (imagens/fontes/ícones, reorganizado)
 *
 * Regras:
 * - Não altera scripts de terceiros (GTM).
 * - Mantém ids/classes/estrutura dos formulários (código JS é preservado).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const IN_HTML_PATH = path.join(ROOT, 'index.html');
const IN_ASSETS_DIR = path.join(ROOT, 'assets');
const IN_TAILWIND_INPUT_CSS = path.join(ROOT, 'src', 'input.css');

const OUT_HTML_PATH = path.join(DIST, 'index.html');
const OUT_CSS_DIR = path.join(DIST, 'css');
const OUT_JS_DIR = path.join(DIST, 'js');
const OUT_ASSETS_DIR = path.join(DIST, 'assets');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rmDirIfExists(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function safeRequire(moduleName) {
  try {
    // eslint-disable-next-line global-require
    return require(moduleName);
  } catch (_) {
    return null;
  }
}

async function maybeOptimizeAssets() {
  const sharp = safeRequire('sharp');
  if (!sharp) {
    copyRecursive(IN_ASSETS_DIR, OUT_ASSETS_DIR);
    console.warn('[build] `sharp` não disponível: assets copiadas sem otimização.');
    return;
  }

  function extLower(p) {
    return path.extname(p).toLowerCase();
  }

  async function copyAndOptimizeFile(srcPath, destPath) {
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      ensureDir(destPath);
      for (const name of fs.readdirSync(srcPath)) {
        await copyAndOptimizeFile(path.join(srcPath, name), path.join(destPath, name));
      }
      return;
    }

    ensureDir(path.dirname(destPath));
    const ext = extLower(srcPath);

    if (ext === '.webp') {
      // Re-encode leve para reduzir payload e manter boa qualidade.
      await sharp(srcPath).webp({ quality: 82, effort: 4 }).toFile(destPath);
      return;
    }

    // Mantém SVG e demais sem alterações (ou copie direto se existirem).
    fs.copyFileSync(srcPath, destPath);
  }

  await copyAndOptimizeFile(IN_ASSETS_DIR, OUT_ASSETS_DIR);
}

async function main() {
  const canonicalUrl = 'https://pos.personaltraineracademy.com.br/';

  const cheerio = safeRequire('cheerio');
  const htmlMinifier = safeRequire('html-minifier-terser');
  const cleanCss = safeRequire('clean-css');
  const terser = safeRequire('terser');

  if (!cheerio) throw new Error('Dependência ausente: `cheerio`.');
  if (!htmlMinifier) throw new Error('Dependência ausente: `html-minifier-terser`.');
  if (!cleanCss) throw new Error('Dependência ausente: `clean-css`.');
  if (!terser) throw new Error('Dependência ausente: `terser`.');

  rmDirIfExists(DIST);
  ensureDir(DIST);
  ensureDir(OUT_CSS_DIR);
  ensureDir(OUT_JS_DIR);
  ensureDir(OUT_ASSETS_DIR);

  // 1) CSS: Tailwind -> dist/css/style.css
  // (purge via tailwind.config.js content: ['./index.html'])
  execSync(`npx tailwindcss -i "${IN_TAILWIND_INPUT_CSS}" -o "${path.join(OUT_CSS_DIR, 'style.css')}" --minify`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // 1.1) minify extra no CSS (clean-css) para reduzir mais.
  const cssPath = path.join(OUT_CSS_DIR, 'style.css');
  const cssRaw = readText(cssPath);
  const cleaner = new cleanCss();
  const minCssResult = cleaner.minify(cssRaw);
  if (minCssResult.styles) writeText(cssPath, minCssResult.styles);

  // 2) HTML: aplicar SEO técnico + extrair JS próprio
  const originalHtml = readText(IN_HTML_PATH);
  const $ = cheerio.load(originalHtml, { decodeEntities: false });

  // 2.0) Extrair CSS inline para dist/css/style.css
  let extractedCss = '';
  $('style').each((_, el) => {
    extractedCss += `${$(el).html() || ''}\n`;
    $(el).remove();
  });
  if (extractedCss.trim()) {
    const currentCss = readText(cssPath);
    const mergedCss = `${currentCss}\n${extractedCss}`;
    const mergedMinified = cleaner.minify(mergedCss);
    writeText(cssPath, mergedMinified.styles || mergedCss);
  }

  // Garante que index.html referencie o CSS buildado.
  if ($('link[href="css/style.css"]').length === 0) {
    $('head').append('<link rel="stylesheet" href="css/style.css">');
  }

  // 2.1) Canonical absoluto
  const canonicalTag = $('link[rel="canonical"]').first();
  if (canonicalTag.length) canonicalTag.attr('href', canonicalUrl);
  else $('head').append(`<link rel="canonical" href="${canonicalUrl}">`);

  // 2.2) OG url alinhado ao canonical
  const ogUrl = $('meta[property="og:url"]').first();
  if (ogUrl.length) ogUrl.attr('content', canonicalUrl);

  // 2.2.1) Open Graph + Twitter Cards (inserir se não existirem)
  const pageTitle = $('title').first().text().trim();
  const pageDescription = $('meta[name="description"]').first().attr('content') || '';
  const baseUrl = canonicalUrl.endsWith('/') ? canonicalUrl : `${canonicalUrl}/`;
  const ogImageUrl = `${baseUrl}assets/WEB.webp`;

  // OG
  const og = [
    { prop: 'og:title', value: pageTitle },
    { prop: 'og:description', value: pageDescription },
    { prop: 'og:image', value: ogImageUrl },
    { prop: 'og:url', value: canonicalUrl },
    { prop: 'og:type', value: 'website' },
  ];
  for (const item of og) {
    const sel = `meta[property="${item.prop}"]`;
    if ($(sel).length) $(sel).attr('content', item.value);
    else $('head').append(`<meta property="${item.prop}" content="${item.value}">`);
  }

  // Twitter
  const tw = [
    { name: 'twitter:card', value: 'summary_large_image' },
    { name: 'twitter:title', value: pageTitle },
    { name: 'twitter:description', value: pageDescription },
    { name: 'twitter:image', value: ogImageUrl },
  ];
  for (const item of tw) {
    const sel = `meta[name="${item.name}"]`;
    if ($(sel).length) $(sel).attr('content', item.value);
    else $('head').append(`<meta name="${item.name}" content="${item.value}">`);
  }

  // 2.3) Preconnects (mantém se já existirem)
  const preconnectHrefs = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://unpkg.com',
  ];
  for (const href of preconnectHrefs) {
    if ($(`link[rel="preconnect"][href="${href}"]`).length === 0) {
      $('head').append(`<link rel="preconnect" href="${href}">`);
    }
  }

  // 2.4) Atualizar paths para dist/assets (remove "./")
  $('img[src^="./assets/"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', src.replace('./assets/', 'assets/'));
  });
  $('source[src^="./assets/"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', src.replace('./assets/', 'assets/'));
  });
  $('source[srcset^="./assets/"]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) $(el).attr('srcset', srcset.replace('./assets/', 'assets/'));
  });
  $('img[srcset^="./assets/"]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) $(el).attr('srcset', srcset.replace('./assets/', 'assets/'));
  });
  $('link[href^="./assets/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) $(el).attr('href', href.replace('./assets/', 'assets/'));
  });

  // 2.5) Extrair scripts inline NÃO-3RD-PARTY (evita mexer no GTM).
  const scriptTags = $('script').toArray();
  let extracted = '';
  let extractedCount = 0;

  for (const el of scriptTags) {
    const node = $(el);
    const src = node.attr('src');
    if (src) continue;

    const code = node.html() || '';
    const isGtm =
      code.includes('googletagmanager.com/gtm.js') ||
      code.includes('GTM-') ||
      code.includes('dataLayer');

    // Tailwind config precisa ficar no HTML para preservar o comportamento do CDN.
    const isTailwindConfig = code.includes('tailwind.config');

    if (isGtm || isTailwindConfig) continue;

    extracted += `${code}\n`;
    extractedCount += 1;
    node.remove();
  }

  if (extractedCount > 0) {
    // Coloca no final do body: os callbacks usam DOMContentLoaded, então defer é seguro.
    $('body').append('<script src="js/main.js" defer></script>');
  }

  if (extractedCount > 0) {
    let minified = terser.minify(extracted, {
      compress: true,
      mangle: true,
      ecma: 2020,
      output: { comments: false },
    });
    if (minified && typeof minified.then === 'function') {
      minified = await minified;
    }
    if (minified.error) throw minified.error;

    const jsOut =
      typeof minified.code === 'string'
        ? minified.code
        : typeof minified.output === 'string'
          ? minified.output
          : typeof minified === 'string'
            ? minified
            : null;

    if (!jsOut) {
      throw new Error('Terser não retornou `code`/`output` (nem string) para o JS extraído.');
    }
    writeText(path.join(OUT_JS_DIR, 'main.js'), jsOut);
  }

  // 3) Minificar HTML (sem minificar JS dentro de scripts)
  const finalHtmlRaw = $.html();
  let finalHtml = htmlMinifier.minify(finalHtmlRaw, {
    collapseWhitespace: true,
    removeComments: false,
    minifyCSS: true,
    minifyJS: false,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    useShortDoctype: true,
    keepClosingSlash: true,
  });

  if (finalHtml && typeof finalHtml.then === 'function') {
    finalHtml = await finalHtml;
  }

  if (!finalHtml || typeof finalHtml !== 'string') {
    throw new Error('html-minifier não retornou HTML como string.');
  }
  writeText(OUT_HTML_PATH, finalHtml);

  // 4) Assets: copiar/otimizar e entregar em dist/assets
  await maybeOptimizeAssets();

  console.log('Build concluído: `dist/` pronto para deploy.');
}

main().catch((err) => {
  console.error('Falha no build:', err);
  process.exit(1);
});
