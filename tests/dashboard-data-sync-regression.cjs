const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

function extractLiteral(variableName, opener, closer) {
  const marker = 'const ' + variableName + ' =';
  const declaration = html.indexOf(marker);
  assert.notStrictEqual(declaration, -1, variableName + ' declaration is missing');
  const openIndex = html.indexOf(opener, declaration);
  assert.notStrictEqual(openIndex, -1, variableName + ' literal start is missing');
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (let index = openIndex; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === opener) depth += 1;
    if (char === closer) {
      depth -= 1;
      if (depth === 0) return html.slice(openIndex, index + 1);
    }
  }
  throw new Error(variableName + ' literal end is missing');
}

function extractArray(name) {
  return vm.runInNewContext('(' + extractLiteral(name, '[', ']') + ')', Object.create(null));
}
function extractObject(name) {
  return vm.runInNewContext('(' + extractLiteral(name, '{', '}') + ')', Object.create(null));
}

const newsData = extractArray('newsData');
const colData = extractArray('colData');
const newsChars = extractObject('newsChars');
const colChars = extractObject('colChars');
const totalNewsChars = Object.values(newsChars).reduce((sum, value) => sum + value, 0);
const totalColChars = Object.values(colChars).reduce((sum, value) => sum + value, 0);
const validPublicationTime = /^([01]\d|2[0-3]):[0-5]\d$/;
const newsHourCounts = Array(24).fill(0);
for (const article of newsData) {
  assert(validPublicationTime.test(article.time || ''), 'ニュース全件に有効な公開時刻が必要です');
  newsHourCounts[Number(article.time.slice(0, 2))] += 1;
}

assert.strictEqual(newsData.length, 90, 'ニュース90件を維持する必要があります');
assert.strictEqual(colData.length, 66, 'コラム66件を維持する必要があります');
assert.strictEqual(newsData[0].id, 90, '最新ニュースID90を維持する必要があります');
assert.strictEqual(newsData[0].date, '2026/10/23', '最新ニュースの公開日を維持する必要があります');
assert.strictEqual(newsData[0].title, '【機能改善・安定化】Ver.4.3「AI案内の起動安定化」— クッキー設定と回答表示を整えました', '最新ニュースのタイトルを維持する必要があります');
assert.strictEqual(newsData[0].tag, '新機能・改善', '最新ニュースのタグを維持する必要があります');
assert.strictEqual(newsData[0].time, '21:25', '最新ニュースの公開時刻を維持する必要があります');
assert.strictEqual(newsChars['90'], 3346, '最新ニュースの本文文字数を維持する必要があります');
assert.strictEqual(newsHourCounts.reduce((sum, count) => sum + count, 0), 90, '時刻分布にニュース全件を集計する必要があります');
assert.strictEqual(newsHourCounts.slice(16, 20).reduce((sum, count) => sum + count, 0), 36, '16〜19時台の件数を維持する必要があります');

assert.strictEqual(colData[0].id, 66, '最新コラムID66を維持する必要があります');
assert.strictEqual(colData[0].date, '2026/10/25', '最新コラムの公開日を維持する必要があります');
assert.strictEqual(colData[0].category, '基礎知識', '最新コラムのカテゴリを維持する必要があります');
assert.strictEqual(colData[0].title, '【基礎知識】氏神さまは生まれた土地の神様？——氏神・産土神・崇敬神社の違い', '最新コラムのタイトルを維持する必要があります');
assert.strictEqual(colData[0].desc, '氏神さまは今住んでいる地域の神様？ 産土神や鎮守、崇敬神社との違いを神社本庁の説明に沿って整理。自分の氏神さまを知る方法や、複数の神社を大切にお参りする考え方も紹介します。', '最新コラムの一覧説明を維持する必要があります');
assert.strictEqual(colChars['66'], 1522, '最新コラムの本文文字数を維持する必要があります');

for (const article of colData) {
  const length = Array.from(article.desc || '').length;
  assert(article.desc && article.desc.trim(), 'コラムID' + article.id + 'の一覧説明が必要です');
  assert(length >= 70 && length <= 105, 'コラムID' + article.id + 'の一覧説明は70〜105字である必要があります（' + length + '字）');
}

assert.strictEqual(totalNewsChars, 92770, 'ニュース本文総文字数を維持する必要があります');
assert.strictEqual(totalColChars, 59193, 'コラム本文総文字数を維持する必要があります');
assert.strictEqual(totalNewsChars + totalColChars, 151963, '全記事の総文字数を維持する必要があります');
assert(html.includes('<dd id="print-total-summary">156記事・151,963字</dd>'), '印刷概要の件数と文字数を維持する必要があります');
assert(html.includes('<dd id="print-period-summary">2025年12月10日〜2026年10月25日（320日間）</dd>'), '印刷概要の対象期間を維持する必要があります');
assert(html.includes('<span class="dashboard-select-value">全記事データ（156件）</span>'), '全記事CSVの件数を維持する必要があります');
assert((html.match(/<th>内容（抜粋）<\/th>/g) || []).length === 2, '両媒体の一覧説明列を統一する必要があります');

const requiredHeadings = [
  '天命乃杜 — 320日間の軌跡が語るもの',
  '▍ フェーズ I — 爆発的始動期（2025年12月〜2026年1月上旬）',
  '▍ フェーズ II — インフラ・機能拡張の集中期（2026年1月中旬〜2月）',
  '▍ フェーズ III — 投稿の空白と運営再開（2026年2月〜4月）',
  '▍ フェーズ IV — 「本数より質」への転換期（2026年5月〜8月）',
  '▍ フェーズ V — 秋の継続改善と読み物の拡充（2026年9月〜10月）',
  '▍ ニュースとコラムの役割分担',
  '▍ 公開日時の分布から見える傾向',
  '▍ 文字数に宿る情報量の違い',
  '▍ 集計の読み方 — 相関と因果を分ける',
  '▍ 分類体系と比較可能性',
  '▍ 運用状態と記事記録の分離',
  '▍ 次回更新で注目する比較軸',
  '▍ 結語 — 数字が示す記録'
];
for (const heading of requiredHeadings) {
  assert(html.includes(heading), '総合分析の既存章見出しを維持する必要があります: ' + heading);
}

assert.strictEqual((html.match(/総合分析・考察/g) || []).length, 1, '総合分析・考察の見出しは一つだけにします');
assert(html.includes('id="article-index-title">記事一覧</div>'), '記事一覧の見出しは日本語に統一します');
assert(!html.includes('Article Index'), '見出しに不要な英語表記を残しません');
assert(!html.includes('chartDescriptionCopy'), '短文で長文説明を上書きする処理を残しません');
assert(!html.includes('chart-desc-auto'), '短文用の空欄を残しません');
assert(!html.includes('読み解きのポイント'), '説明欄ラベルを旧称へ統一します');

const chartDescriptions = [...html.matchAll(/<div class="chart-desc"><div class="chart-desc-title">▍ 洞察・考察<\/div>([\s\S]*?)<\/div>\s*<\/div>/g)];
assert.strictEqual(chartDescriptions.length, 38, '38個すべてのグラフ説明を維持する必要があります');
const chartNarrativeText = chartDescriptions
  .map((match) => match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ''))
  .join('');
const descriptionLengths = chartDescriptions.map((match) => Array.from(match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '')).length);
assert(descriptionLengths.every((length) => length >= 110), 'すべてのグラフに十分な説明文が必要です');
assert(descriptionLengths.filter((length) => length >= 320).length >= 30, '長文の考察を30件以上維持する必要があります');
assert(Array.from(chartNarrativeText).length >= 15000, '全グラフの考察総文字数を維持する必要があります');
assert((html.match(/▍ 洞察・考察/g) || []).length === 38, '説明欄の見出しを全38件で統一する必要があります');

const summaryStart = html.indexOf('  <!-- MEGA SUMMARY -->');
const summaryEnd = html.indexOf('  <!-- ARTICLE TABLES -->', summaryStart);
assert(summaryStart >= 0 && summaryEnd > summaryStart, '総合分析本文が必要です');
const summaryText = html.slice(summaryStart, summaryEnd).replace(/<[^>]+>/g, '').replace(/\s+/g, '');
assert(Array.from(summaryText).length >= 3000, '総合分析本文の文章量を維持する必要があります');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());
for (const script of scripts) new Function(script);

console.log('記事データ・38件の洞察文・総合分析・見出し統一の回帰テストに合格しました。');
console.log(JSON.stringify({
  news: newsData.length,
  columns: colData.length,
  total: newsData.length + colData.length,
  totalChars: totalNewsChars + totalColChars,
  latestNews: newsData[0].id,
  latestColumn: colData[0].id,
  chartNarratives: chartDescriptions.length,
  chartNarrativeCharacters: Array.from(chartNarrativeText).length,
  preservedFullNarratives: true
}, null, 2));
