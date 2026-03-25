/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const terser = require('terser');

const projectRoot = __dirname;

const DIST_DIR = path.join(projectRoot, 'dist');
const DIST_CSS_DIR = path.join(DIST_DIR, 'css');
const DIST_JS_DIR = path.join(DIST_DIR, 'js');
const DIST_ASSETS_DIR = path.join(DIST_DIR, 'assets');

const SRC_INDEX = path.join(projectRoot, 'index.html');
const SRC_IMG_DIR = path.join(projectRoot, 'img');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rmDir(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeText(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function main() {
  if (!fs.existsSync(SRC_INDEX)) throw new Error(`Nao encontrei ${SRC_INDEX}`);
  if (!fs.existsSync(SRC_IMG_DIR)) throw new Error(`Nao encontrei ${SRC_IMG_DIR}`);

  // 1) limpar dist
  rmDir(DIST_DIR);
  ensureDir(DIST_CSS_DIR);
  ensureDir(DIST_JS_DIR);
  ensureDir(DIST_ASSETS_DIR);

  // 2) copiar assets locais
  fs.cpSync(SRC_IMG_DIR, path.join(DIST_ASSETS_DIR, 'img'), { recursive: true });

  // 3) gerar CSS Tailwind (purge via tailwind.config.js)
  execSync('npm run build:css', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // garantir que o CSS final fica minimizado com um passo extra
  const cssPath = path.join(DIST_CSS_DIR, 'style.css');
  if (!fs.existsSync(cssPath)) throw new Error(`Nao encontrei ${cssPath} apos build:css`);
  const cssRaw = readText(cssPath);
  const cssMinified = new CleanCSS({ level: 2 }).minify(cssRaw).styles;
  writeText(cssPath, cssMinified);

  // 4) converter imagens "referenciadas" para WebP (opcional via sharp)
  let sharp = null;
  try {
    // sharp pode nao estar instalado caso falhe o install; neste caso mantemos os originais.
    sharp = require('sharp');
  } catch {
    sharp = null;
  }

  const heroPng = path.join(DIST_ASSETS_DIR, 'img', 'capaVideoHero.png');
  const heroWebp = path.join(DIST_ASSETS_DIR, 'img', 'capaVideoHero.webp');
  const depJpg = path.join(DIST_ASSETS_DIR, 'img', 'depoinemtos', 'depimentos.jpg');
  const depWebp = path.join(DIST_ASSETS_DIR, 'img', 'depoinemtos', 'depimentos.webp');

  if (sharp) {
    try {
      if (fs.existsSync(heroPng) && !fs.existsSync(heroWebp)) {
        await sharp(heroPng).webp({ quality: 80, effort: 6 }).toFile(heroWebp);
        // remove o original para reduzir peso no deploy (mantemos apenas o que o HTML referenciar).
        fs.unlinkSync(heroPng);
      }
      if (fs.existsSync(depJpg) && !fs.existsSync(depWebp)) {
        await sharp(depJpg).webp({ quality: 75, effort: 6 }).toFile(depWebp);
        fs.unlinkSync(depJpg);
      }
    } catch (e) {
      console.warn('[build.js] Falha ao converter imagens para WebP. Mantendo originais.', e?.message || e);
      // Se falhar, nao removemos os originais.
    }
  }

  // 5) processar HTML de entrada e montar dist/index.html
  let html = readText(SRC_INDEX);

  // 5.1) Acessibilidade: alt nao vazio
  // (string literal para evitar regex frágil)
  html = html.replace(
    'src="img/heroBg.webp" alt=""',
    'src="img/heroBg.webp" alt="Fundo decorativo da Biomecânica"'
  );

  // 5.2) substituicao de paths para nova estrutura
  html = html.replace(/href=["']style\.css["']/g, 'href="css/style.css"');

  // imagens especificas que viram WebP
  html = html.replace(
    /src=["']img\/capaVideoHero\.png["']/g,
    'src="assets/img/capaVideoHero.webp"'
  );
  html = html.replace(
    /src=["']img\/depoinemtos\/depimentos\.jpg["']/g,
    'src="assets/img/depoinemtos/depimentos.webp"'
  );

  // restante das imagens locais
  html = html.replace(/src=(["'])img\//g, 'src=$1assets/img/');
  html = html.replace(/href=(["'])img\//g, 'href=$1assets/img/');

  // 5.3) inserir SEO tecnico no <head>
  const canonicalUrl = 'https://pos.personaltraineracademy.com.br/';
  const description =
    'Garanta sua vaga na Pós-graduação em Biomecânica com o Método ADR: avaliação, decisão e resultado prático. Turma 2026 com vagas limitadas.';
  const ogImageUrl = 'https://pos.personaltraineracademy.com.br/assets/img/heroBg.webp';

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : 'Pós-graduação em Biomecânica — Especialista pro';

  // adiciona tags somente se nao existirem
  const seoBlock = [
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(ogImageUrl)}">`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(ogImageUrl)}">`,
    `<meta name="robots" content="index,follow">`,
    `<meta name="theme-color" content="#030912">`,
  ].join('');

  if (!/<meta\s+name=["']description["']/.test(html)) {
    html = html.replace(/(<title>[^<]+<\/title>)/i, `$1${seoBlock}`);
  }

  // performance hints (preconnect para CDNs/servicos usados)
  if (!html.includes('href="https://cdnjs.cloudflare.com"')) {
    html = html.replace(
      /<head>/i,
      '<head><link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>'
    );
  }
  if (!html.includes('href="https://unpkg.com"')) {
    html = html.replace(
      /<head>/i,
      '<head><link rel="preconnect" href="https://unpkg.com" crossorigin>'
    );
  }
  if (!html.includes('href="https://www.googletagmanager.com"')) {
    html = html.replace(
      /<head>/i,
      '<head><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>'
    );
  }

  // 5.4) separar JS inline para dist/js/main.js (preservar GTM)
  // encontra o script que contem WEBHOOK_URL (nosso JS principal)
  const webhookPos = html.indexOf('var WEBHOOK_URL');
  if (webhookPos === -1) throw new Error('Nao encontrei WEBHOOK_URL no HTML');

  const scriptStart = html.lastIndexOf('<script>', webhookPos);
  const scriptEnd = html.indexOf('</script>', webhookPos);
  if (scriptStart === -1 || scriptEnd === -1) throw new Error('Nao foi possivel extrair o script principal');

  const mainScript = html.slice(scriptStart + '<script>'.length, scriptEnd);
  fs.writeFileSync(path.join(DIST_JS_DIR, 'main.raw.js'), mainScript);

  // minificar/obfuscar mantendo nomes globais usados por onclick
  const mainMin = await terser.minify(mainScript, {
    ecma: 2020,
    compress: { passes: 2, defaults: true },
    mangle: { toplevel: false, keep_fnames: true },
    format: { comments: false },
  });
  if (!mainMin || !mainMin.code) throw new Error('Falha ao minificar JS');
  fs.writeFileSync(path.join(DIST_JS_DIR, 'main.js'), mainMin.code);
  fs.unlinkSync(path.join(DIST_JS_DIR, 'main.raw.js'));

  // substituir o bloco inline pelo script externo
  html =
    html.slice(0, scriptStart) +
    '<script src="js/main.js" defer></script>' +
    html.slice(scriptEnd + '</script>'.length);

  // 5.5) preservar GTM: placeholder para nao minificar/alterar o conteudo do script
  const gtmNeedle = '<script>(function(w,d,s,l,i){';
  const gtmStart = html.indexOf(gtmNeedle);
  if (gtmStart !== -1) {
    const gtmEnd = html.indexOf('</script>', gtmStart);
    if (gtmEnd !== -1) {
      const gtmBlock = html.slice(gtmStart, gtmEnd + '</script>'.length);
      html = html.slice(0, gtmStart) + '__GTM_BLOCK_0__' + html.slice(gtmEnd + '</script>'.length);
      // 5.6) minificar HTML
      const min = await minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        minifyCSS: false,
        minifyJS: false,
        // preserva conteudo em tags script (principalmente o GTM) sem "mexer"
        ignoreCustomFragments: [/__GTM_BLOCK_0__/],
      });
      let finalHtml = (typeof min === 'string' ? min : min.code) || '';
      finalHtml = finalHtml.replace('__GTM_BLOCK_0__', gtmBlock);

      writeText(path.join(DIST_DIR, 'index.html'), finalHtml);
      return;
    }
  }

  // fallback sem GTM (nao deveria acontecer)
  const min = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    minifyCSS: false,
    minifyJS: false,
  });
  writeText(path.join(DIST_DIR, 'index.html'), (typeof min === 'string' ? min : min.code) || '');
}

main()
  .then(() => {
    console.log('[build.js] Build concluido em dist/.');
  })
  .catch((err) => {
    console.error('[build.js] Erro:', err);
    process.exitCode = 1;
  });

