const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const faviconDir = path.join(root, 'favicon');
const requiredFiles = [
  'favicon.svg',
  'favicon.ico',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'site.webmanifest',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(faviconDir, file)), `検索・端末向けアイコンが favicon/${file} にありません。`);
}

[
  '<link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" sizes="96x96" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />',
  '<link rel="shortcut icon" href="/favicon/favicon.ico" />',
  '<link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />',
  '<link rel="manifest" href="/favicon/site.webmanifest" />',
].forEach((reference) => {
  assert(html.includes(reference), `検索・ブラウザ向けファビコン宣言が不足しています: ${reference}`);
});

const png = fs.readFileSync(path.join(faviconDir, 'favicon-96x96.png'));
assert.equal(png.toString('ascii', 1, 4), 'PNG', '検索用PNGファビコンの形式が不正です。');
assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), '検索用PNGファビコンは正方形でなければなりません。');
assert(png.readUInt32BE(16) >= 48, '検索用PNGファビコンは48px以上にしてください。');

const manifest = JSON.parse(fs.readFileSync(path.join(faviconDir, 'site.webmanifest'), 'utf8'));
assert.equal(manifest.name, '天命乃杜 記事分析ダッシュボード', 'Manifestのアプリ名がダッシュボード名と一致しません。');
assert.equal(manifest.short_name, '天命乃杜分析', 'Manifestの短縮名がダッシュボード名と一致しません。');
assert(manifest.icons.some((icon) => icon.src === '/favicon/web-app-manifest-192x192.png' && icon.sizes === '192x192'), '192pxのManifestアイコン参照が不正です。');
assert(manifest.icons.some((icon) => icon.src === '/favicon/web-app-manifest-512x512.png' && icon.sizes === '512x512'), '512pxのManifestアイコン参照が不正です。');

assert.equal(fs.existsSync(path.join(root, 'favicon (2)')), false, '旧ファビコンディレクトリが残っています。');

console.log('ダッシュボードの検索・ブラウザ向けファビコン回帰テストに合格しました。');
