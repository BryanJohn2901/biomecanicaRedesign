#!/usr/bin/env node
/**
 * Converte imagens JPG e PNG em WebP (qualidade 80%) dentro de img/ e subpastas.
 * Uso: node convert-images.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMG_DIR = path.join(__dirname, 'img');
const EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const WEBP_QUALITY = 80;

function getAllImagePaths(dir, files = []) {
  if (!fs.existsSync(dir)) {
    console.warn('Pasta img/ não encontrada. Nada a converter.');
    return files;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllImagePaths(fullPath, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function convertToWebp(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const outPath = path.join(dir, base + '.webp');

  await sharp(filePath)
    .webp({ quality: WEBP_QUALITY })
    .toFile(outPath);

  return outPath;
}

async function main() {
  console.log('Buscando imagens em img/ (recursivo)...');
  const files = getAllImagePaths(IMG_DIR);
  if (files.length === 0) {
    console.log('Nenhuma imagem .jpg/.png encontrada.');
    return;
  }
  console.log(`Encontradas ${files.length} imagem(ns). Convertendo para WebP (${WEBP_QUALITY}% qualidade)...`);
  let ok = 0;
  let err = 0;
  for (const file of files) {
    try {
      const out = await convertToWebp(file);
      console.log('  OK:', path.relative(__dirname, out));
      ok++;
    } catch (e) {
      console.error('  ERRO:', file, e.message);
      err++;
    }
  }
  console.log(`Concluído: ${ok} convertidas, ${err} erro(s).`);
  if (err > 0) process.exit(1);
}

main();
