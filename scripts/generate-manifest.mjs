// scripts/generate-manifest.mjs
import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');
const manifestPath = path.join(process.cwd(), 'src', 'lib', 'asset-manifest.json');

function getAssetPaths() {
  const manifest = {
    images: [],
    games: [],
    favicons: [],
  };

  // Получаем пути к картинкам
  try {
    const casinoImageDir = path.join(publicDir, 'images', 'img-casino');
    manifest.images = fs.readdirSync(casinoImageDir)
      .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
      .map(file => `images/img-casino/${file}`);
  } catch (e) {
    console.warn('Could not read images directory for manifest.', e.message);
  }

  // Получаем названия папок с играми
  try {
    const gamesDir = path.join(publicDir, 'games');
    manifest.games = fs.readdirSync(gamesDir)
      .filter(name => fs.statSync(path.join(gamesDir, name)).isDirectory());
  } catch (e) {
    console.warn('Could not read games directory for manifest.', e.message);
  }

  try {
    const faviconDir = path.join(publicDir, 'images', 'favicon');
    manifest.favicons = fs.readdirSync(faviconDir)
      .filter(file => /\.(png)$/i.test(file))
      .map(file => `images/favicon/${file}`);
  } catch (e) {
    console.warn('Could not read favicon directory for manifest.', e.message);
  }

  return manifest;
}

const manifestData = getAssetPaths();
fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));

console.log('✅ Asset manifest generated successfully at:', manifestPath);
