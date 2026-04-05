const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const sharp = require('sharp');

const ROOT = __dirname;
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_CSS_DIR = path.join(DIST_DIR, 'css');
const DIST_JS_DIR = path.join(DIST_DIR, 'js');
const DIST_ASSETS_DIR = path.join(DIST_DIR, 'assets');

const SOURCE_HTML = path.join(ROOT, 'index.html');
const SOURCE_TW_INPUT = path.join(ROOT, 'src', 'input.css');
const TMP_TW_OUTPUT = path.join(ROOT, '.tmp-tailwind-build.css');

const CANONICAL_URL = 'https://pos.personaltraineracademy.com.br/';
const SHARE_URL = 'https://pos.personaltraineracademy.com.br/';
const OG_IMAGE_URL = 'https://pos.personaltraineracademy.com.br/assets/og-banner.webp';
const PAGE_TITLE = 'Pós-Graduação em Treinamento Feminino | PTA Women';
const PAGE_DESCRIPTION =
  'Pós-graduação em Treinamento Funcional e Saúde da Mulher com reconhecimento MEC. 360h em 18 meses, formato 100% online. Torne-se referência em fisiologia hormonal, emagrecimento e hipertrofia.';

function cleanDist() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_CSS_DIR, { recursive: true });
  fs.mkdirSync(DIST_JS_DIR, { recursive: true });
  fs.mkdirSync(DIST_ASSETS_DIR, { recursive: true });
  fs.mkdirSync(path.join(DIST_ASSETS_DIR, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(DIST_ASSETS_DIR, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(DIST_ASSETS_DIR, 'icons'), { recursive: true });
}

function buildTailwind() {
  execSync(`npx tailwindcss -i "${SOURCE_TW_INPUT}" -o "${TMP_TW_OUTPUT}" --minify`, {
    stdio: 'inherit',
    cwd: ROOT,
  });
  return fs.readFileSync(TMP_TW_OUTPUT, 'utf8');
}

function ensureHeadTag(html, regex, content) {
  if (regex.test(html)) return html;
  return html.replace('</head>', `${content}\n</head>`);
}

function normalizeHeadSeo(html) {
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${PAGE_TITLE}</title>`);

  if (/<meta\s+name=["']description["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${PAGE_DESCRIPTION}">`
    );
  } else {
    html = html.replace('</title>', `</title>\n    <meta name="description" content="${PAGE_DESCRIPTION}">`);
  }

  if (/<link\s+rel=["']canonical["']/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${CANONICAL_URL}">`
    );
  } else {
    html = html.replace('</head>', `    <link rel="canonical" href="${CANONICAL_URL}">\n</head>`);
  }

  const socialTags = `
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SHARE_URL}">
    <meta property="og:title" content="${PAGE_TITLE}">
    <meta property="og:description" content="${PAGE_DESCRIPTION}">
    <meta property="og:image" content="${OG_IMAGE_URL}">
    <meta property="og:locale" content="pt_BR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${SHARE_URL}">
    <meta name="twitter:title" content="${PAGE_TITLE}">
    <meta name="twitter:description" content="${PAGE_DESCRIPTION}">
    <meta name="twitter:image" content="${OG_IMAGE_URL}">`;

  if (!/<meta\s+property=["']og:title["']/i.test(html)) {
    html = html.replace('</head>', `${socialTags}\n</head>`);
  }

  html = ensureHeadTag(
    html,
    /<link\s+rel=["']preconnect["']\s+href=["']https:\/\/fonts\.googleapis\.com["']/i,
    `    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
  );

  return html;
}

function copyDirSafe(source, target) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, target, { recursive: true });
}

function collectImageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectImageFiles(full));
    } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function optimizeImagesAndBuildReplacementMap() {
  const replacementMap = new Map();
  const distImgDir = path.join(DIST_ASSETS_DIR, 'img');
  const images = collectImageFiles(distImgDir);

  for (const imagePath of images) {
    const ext = path.extname(imagePath);
    const webpPath = imagePath.replace(new RegExp(`${ext}$`, 'i'), '.webp');
    await sharp(imagePath).webp({ quality: 82, effort: 5 }).toFile(webpPath);

    const originalRef = path
      .relative(DIST_DIR, imagePath)
      .split(path.sep)
      .join('/');
    const webpRef = path
      .relative(DIST_DIR, webpPath)
      .split(path.sep)
      .join('/');
    replacementMap.set(originalRef, webpRef);
  }

  return replacementMap;
}

async function build() {
  cleanDist();

  let html = fs.readFileSync(SOURCE_HTML, 'utf8');

  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  html = html.replace(/<style>[\s\S]*?<\/style>/gi, '');

  const mainScriptRegex = /<script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>/i;
  const mainScriptMatch = html.match(mainScriptRegex);
  if (!mainScriptMatch) {
    throw new Error('Script principal inline não encontrado para extração.');
  }
  const mainScript = mainScriptMatch[0]
    .replace(/^<script>/i, '')
    .replace(/<\/script>$/i, '')
    .trim();
  html = html.replace(mainScriptRegex, '');

  const tailwindCss = buildTailwind();
  const mergedCss = `${tailwindCss}\n${styles}`;
  const cssMinified = new CleanCSS({ level: 2 }).minify(mergedCss);
  if (cssMinified.errors.length) {
    throw new Error(`Erro ao minificar CSS: ${cssMinified.errors.join('; ')}`);
  }
  fs.writeFileSync(path.join(DIST_CSS_DIR, 'style.css'), cssMinified.styles, 'utf8');

  const jsMinified = await minifyJs(mainScript, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });
  if (!jsMinified.code) {
    throw new Error('Falha ao minificar JS principal.');
  }
  fs.writeFileSync(path.join(DIST_JS_DIR, 'main.min.js'), jsMinified.code, 'utf8');

  html = html.replace(/<link[^>]*href=["']\.?\/?output\.css["'][^>]*>/i, '<link rel="stylesheet" href="css/style.css">');
  html = html.replace('</body>', '    <script src="js/main.min.js" defer></script>\n</body>');

  html = normalizeHeadSeo(html);
  html = html.replace(/\salt=(['"])\1/g, ' alt="Imagem decorativa"');

  html = html.replace(/(["'(=\s])img\//g, '$1assets/img/');
  html = html.replace(/(["'(=\s])favicon\.ico/g, '$1assets/favicon.ico');

  copyDirSafe(path.join(ROOT, 'img'), path.join(DIST_ASSETS_DIR, 'img'));
  copyDirSafe(path.join(ROOT, 'fonts'), path.join(DIST_ASSETS_DIR, 'fonts'));
  copyDirSafe(path.join(ROOT, 'videos'), path.join(DIST_ASSETS_DIR, 'videos'));
  copyDirSafe(path.join(ROOT, 'icons'), path.join(DIST_ASSETS_DIR, 'icons'));

  const rootFilesToCopy = ['favicon.ico', 'robots.txt', 'sitemap.xml'];
  rootFilesToCopy.forEach((file) => {
    const source = path.join(ROOT, file);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(DIST_ASSETS_DIR, file));
    }
  });

  const imageReplacementMap = await optimizeImagesAndBuildReplacementMap();
  for (const [from, to] of imageReplacementMap.entries()) {
    html = html.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
  }

  const htmlMinified = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: false,
    minifyCSS: false,
    minifyJS: false,
    removeRedundantAttributes: true,
    removeEmptyAttributes: false,
    keepClosingSlash: true,
    caseSensitive: true,
  });

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), htmlMinified, 'utf8');

  if (fs.existsSync(TMP_TW_OUTPUT)) {
    fs.rmSync(TMP_TW_OUTPUT, { force: true });
  }
}

build()
  .then(() => {
    console.log('Build finalizado com sucesso em dist/.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
