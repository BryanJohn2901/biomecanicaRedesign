/**
 * Build de produção: dist/ estática pronta para deploy.
 * Estrutura: index.html | css/ | js/ | assets/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fse = require('fs-extra');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');

const root = __dirname;
const dist = path.join(root, 'dist');

const RE_GTM_HEAD =
  /<!-- Google Tag Manager -->\s*<script>[\s\S]*?<\/script>\s*<!-- End Google Tag Manager -->/;
const RE_GTM_BODY =
  /<!-- Google Tag Manager \(noscript\) -->\s*<noscript>[\s\S]*?<\/noscript>\s*<!-- End Google Tag Manager \(noscript\) -->/;

function cleanDist() {
  fse.removeSync(dist);
  fse.ensureDirSync(path.join(dist, 'css'));
  fse.ensureDirSync(path.join(dist, 'js'));
  fse.ensureDirSync(path.join(dist, 'assets'));
}

function buildTailwind() {
  execSync('npx tailwindcss -i src/input.css -o dist/css/style.css --minify', {
    cwd: root,
    stdio: 'inherit',
  });
  const cssPath = path.join(dist, 'css', 'style.css');
  const raw = fs.readFileSync(cssPath, 'utf8');
  const out = new CleanCSS({ level: 2 }).minify(raw);
  if (out.errors && out.errors.length) {
    console.warn('clean-css:', out.errors);
  }
  fs.writeFileSync(cssPath, out.styles, 'utf8');
}

async function buildAppJs() {
  const srcPath = path.join(root, 'js', 'main.js');
  if (!fse.existsSync(srcPath)) {
    throw new Error('js/main.js não encontrado.');
  }
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = await minifyJs(code, {
    compress: true,
    mangle: true,
    format: { comments: false, ecma: 2015 },
  });
  if (result.error) throw result.error;
  fs.writeFileSync(path.join(dist, 'js', 'main.js'), result.code, 'utf8');
}

function copyAssets() {
  const imgDir = path.join(root, 'img');
  if (fse.existsSync(imgDir)) {
    fse.copySync(imgDir, path.join(dist, 'assets', 'img'));
  }
}

async function optimizeRasterImages(assetsImgDir) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.warn('[build] sharp não instalado — imagens copiadas sem recompressão.');
    return;
  }
  if (!fse.existsSync(assetsImgDir)) return;

  async function processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const tmp = filePath + '.opt.tmp';
    try {
      if (['.jpg', '.jpeg'].includes(ext)) {
        await sharp(filePath).jpeg({ quality: 82, mozjpeg: true }).toFile(tmp);
        await fse.move(tmp, filePath, { overwrite: true });
      } else if (ext === '.png') {
        await sharp(filePath).png({ compressionLevel: 9, quality: 85 }).toFile(tmp);
        await fse.move(tmp, filePath, { overwrite: true });
      } else if (ext === '.webp') {
        await sharp(filePath).webp({ quality: 82 }).toFile(tmp);
        await fse.move(tmp, filePath, { overwrite: true });
      }
    } catch (e) {
      await fse.remove(tmp).catch(() => {});
      console.warn('[build] otimização ignorada:', filePath, e.message);
    }
  }

  async function walk(dir) {
    const entries = await fse.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else await processFile(full);
    }
  }
  await walk(assetsImgDir);
}

async function buildHtml() {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/\.\/output\.css/g, 'css/style.css');
  html = html.replace(/href=["']\.\/output\.css["']/g, 'href="css/style.css"');
  html = html.replace(/href=["']output\.css["']/g, 'href="css/style.css"');
  html = html.replace(/src="img\//g, 'src="assets/img/');
  html = html.replace(/href="img\//g, 'href="assets/img/');
  html = html.replace(/href="favicon\.ico"/g, 'href="assets/favicon.ico"');

  const mHead = html.match(RE_GTM_HEAD);
  const mBody = html.match(RE_GTM_BODY);
  let safe = html;
  if (mHead) safe = safe.replace(RE_GTM_HEAD, '__GTM_HEAD_PLACEHOLDER__');
  if (mBody) safe = safe.replace(RE_GTM_BODY, '__GTM_BODY_PLACEHOLDER__');

  const minified = await minifyHtml(safe, {
    collapseWhitespace: true,
    removeComments: false,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: false,
    minifyJS: false,
    keepClosingSlash: true,
    caseSensitive: true,
    conservativeCollapse: true,
  });

  let final = minified;
  if (mHead) final = final.replace('__GTM_HEAD_PLACEHOLDER__', mHead[0]);
  if (mBody) final = final.replace('__GTM_BODY_PLACEHOLDER__', mBody[0]);

  fs.writeFileSync(path.join(dist, 'index.html'), final, 'utf8');
}

function buildLocalOutputCss() {
  execSync('npx tailwindcss -i src/input.css -o output.css --minify', {
    cwd: root,
    stdio: 'inherit',
  });
}

async function main() {
  console.log('[build] Limpando dist/…');
  cleanDist();
  console.log('[build] Tailwind + clean-css…');
  buildTailwind();
  console.log('[build] Copiando assets…');
  copyAssets();
  const assetsImg = path.join(dist, 'assets', 'img');
  console.log('[build] Otimizando imagens (sharp)…');
  await optimizeRasterImages(assetsImg);
  console.log('[build] Minificando js/main.js…');
  await buildAppJs();
  console.log('[build] Gerando index.html minificado…');
  await buildHtml();
  console.log('[build] output.css para desenvolvimento local…');
  buildLocalOutputCss();
  console.log('[build] Concluído:', dist);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
