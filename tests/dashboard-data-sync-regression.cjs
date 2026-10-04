const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

function extractLiteral(variableName, opener, closer) {
  const declaration = new RegExp(`\\bconst\\s+${variableName}\\s*=`).exec(html);
  assert(declaration, `${variableName} declaration is missing`);
  const openIndex = html.indexOf(opener, declaration.index);
  assert.notStrictEqual(openIndex, -1, `${variableName} literal start is missing`);

  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let depth = 0;
  for (let index = openIndex; index < html.length; index += 1) {
    const char = html[index];
    const next = html[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === opener) depth += 1;
    if (char === closer) {
      depth -= 1;
      if (depth === 0) return html.slice(openIndex, index + 1);
    }
  }
  throw new Error(`${variableName} literal end is missing`);
}

function extractArray(variableName) {
  return vm.runInNewContext(`(${extractLiteral(variableName, '[', ']')})`, Object.create(null));
}

function extractObject(variableName) {
  return vm.runInNewContext(`(${extractLiteral(variableName, '{', '}')})`, Object.create(null));
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
  if (validPublicationTime.test(article.time || '')) {
    newsHourCounts[Number(article.time.slice(0, 2))] += 1;
  }
}

assert.strictEqual(newsData.length, 89, '社務所だよりは本サイトの最新89件と一致する必要があります');
assert.strictEqual(colData.length, 65, '神籤草子は本サイトの最新65件と一致する必要があります');
assert.strictEqual(newsData[0].id, 89, 'Ver.4.2社務所だよりを最新ニュースとして含める必要があります');
assert.strictEqual(newsData[0].date, '2026/10/02', 'Ver.4.2社務所だよりの日付を保持する必要があります');
assert.strictEqual(newsChars['89'], 3952, 'Ver.4.2社務所だよりの本文文字数を本サイトと一致させる必要があります');
assert.strictEqual(newsData[0].title, '【安定化・セキュリティ強化】Ver.4.2「運用基盤と安全性の強化」— 履歴・監視・ナビゲーション・認証を整えました', 'Ver.4.2社務所だよりの最新タイトルを本サイトと一致させる必要があります');
assert.strictEqual(newsData[0].tag, '安定化・セキュリティ', 'Ver.4.2社務所だよりのタグを本サイトと一致させる必要があります');
assert.strictEqual(newsData[0].time, '21:15', 'Ver.4.2社務所だよりの公開時刻を本サイトと一致させる必要があります');
assert(newsData.every((article) => validPublicationTime.test(article.time || '')), '投稿時刻・曜日×時間帯グラフのため、ニュース全89件に有効な公開時刻を保持する必要があります');
assert.strictEqual(newsHourCounts.reduce((sum, count) => sum + count, 0), 89, '投稿時刻ヒストグラムにニュース全89件を集計する必要があります');
assert.strictEqual(newsHourCounts.slice(16, 20).reduce((sum, count) => sum + count, 0), 36, '16〜19時台の投稿数を洞察・考察本文と一致させる必要があります');

assert.strictEqual(colData[0].id, 65, '神無月コラムを最新神籤草子として追加する必要があります');
assert.strictEqual(colData[0].date, '2026/10/02', '神無月コラムの日付を本サイトと一致させる必要があります');
assert.strictEqual(colData[0].category, '年中行事', '神無月コラムのカテゴリを本サイトと一致させる必要があります');
assert.strictEqual(colData[0].title, '【年中行事】神無月って、神様がいなくなる月？——出雲の「神在月」と秋の祈り', '神無月コラムのタイトルを本サイトと一致させる必要があります');
assert.strictEqual(colData[0].desc, '10月の別名「神無月」と、出雲で「神在月」と呼ぶ習わしを紹介。神々が集まるという伝承、神在祭の意味、旧暦と現在の暦の違いを整理し、秋の季節感とともにひもときます。', '神無月コラムの一覧説明を本サイトと一致させる必要があります');

for (const article of colData) {
  const length = Array.from(article.desc || '').length;
  assert(article.desc && article.desc.trim(), `神籤草子ID${article.id}の一覧説明が不足しています`);
  assert(length >= 70 && length <= 105, `神籤草子ID${article.id}の一覧説明は70〜105字である必要があります（${length}字）`);
}

assert.strictEqual(colChars['1'], 849, '神籤草子ID1の本文文字数を本サイトのDOM計算と一致させる必要があります');
assert.strictEqual(colChars['2'], 617, '神籤草子ID2の本文文字数を本サイトのDOM計算と一致させる必要があります');
assert.strictEqual(colChars['3'], 484, '神籤草子ID3の本文文字数を本サイトのDOM計算と一致させる必要があります');
assert.strictEqual(colChars['4'], 420, '神籤草子ID4の本文文字数を本サイトのDOM計算と一致させる必要があります');
assert.strictEqual(colChars['61'], 1280, 'お盆コラムの本文文字数を本サイトと一致させる必要があります');
assert.strictEqual(colChars['65'], 2110, '神無月コラムの本文文字数を本サイトのDOM計算と一致させる必要があります');
assert.strictEqual(totalNewsChars, 89424, 'ニュース本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalColChars, 57671, 'コラム本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalNewsChars + totalColChars, 147095, '総文字数を本サイトと一致させる必要があります');

assert(html.includes('<dd id="print-total-summary">154記事・147,095字</dd>'), '印刷概要の収録件数と文字数を最新値へ更新する必要があります');
assert(html.includes('<dd id="print-period-summary">2025年12月10日〜2026年10月2日（296日間）</dd>'), '印刷概要の期間を最新値へ更新する必要があります');
assert(html.includes('<span class="dashboard-select-value">全記事データ（154件）</span>'), 'CSVの全記事件数を最新値へ更新する必要があります');
assert((html.match(/<th>内容（抜粋）<\/th>/g) || []).length === 2, '社務所だよりと神籤草子の説明列は同じ「内容（抜粋）」表記へ統一する必要があります');
assert(html.includes('<td class="desc-cell">${a.desc}</td>'), '神籤草子の一覧説明を全件表示する必要があります');
assert(html.includes('colspan="6" class="no-results"'), '神籤草子一覧の説明列追加後も検索結果なしの表示列数を整合させる必要があります');

const requiredNarrativeHeadings = [
  '天命乃杜 — 296日間の軌跡が語るもの',
  '▍ フェーズ I — 爆発的始動期（2025年12月〜2026年1月上旬）',
  '▍ フェーズ II — インフラ激動期（2026年1月中旬〜下旬）',
  '▍ フェーズ III — 成熟・洗練期から長期充電へ（2026年2月〜4月）',
  '▍ フェーズ IV — 「本数より質」への転換期（2026年5月〜8月）',
  '▍ ニュースとコラムの役割分担という戦略的決定',
  '▍ 開発者の行動リズムが示す持続可能性',
  '▍ 文字数に宿るプロダクト哲学',
  '▍ 結語 — 数字が証明するもの',
];
for (const heading of requiredNarrativeHeadings) {
  assert(html.includes(heading), `包括分析の既存章見出しを保持する必要があります: ${heading}`);
}

const requiredChartNarratives = [
  '全154記事（ニュース89本＋コラム65本）を文字数に基づいて',
  'ミドルクラスが過半数（約54%・81本）を占め、次いでショートが約20%（31本）、ロングが約27%（42本）',
  '65本のコラム記事（神籤草子）に付与されたカテゴリの分布だ。',
  '10月2日時点で合計154記事に到達している。',
  '総文字数は147,095字に達しており',
  '神籤草子65本の投稿曜日の分布だ。',
  '10月2日の神無月コラムまで記録している。',
  '10月2日には「神無月」を扱うコラムが加わっている。',
  '154本・147,095字・296日間・4回のDBマイグレーション',
];
for (const sentence of requiredChartNarratives) {
  assert(html.includes(sentence), `既存の洞察・考察本文を保ち、最新数値を反映する必要があります: ${sentence}`);
}

assert(!html.includes('DASHBOARD_SYNC_NARRATIVES_START'), '既存の洞察・考察本文を動的な短文で置き換えてはいけません');
assert(!html.includes('id="dynamic-summary"'), '包括分析の既存本文を削除してはいけません');
const chartDescriptions = [...html.matchAll(/<div class="chart-desc"><div class="chart-desc-title">▍ 洞察・考察<\/div>([\s\S]*?)<\/div>/g)];
assert(chartDescriptions.length >= 20, 'グラフごとの洞察・考察本文を20件以上維持する必要があります');
const chartNarrativeText = chartDescriptions
  .map((match) => match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ''))
  .join('');
assert(Array.from(chartNarrativeText).length >= 12500, 'グラフごとの洞察・考察本文の総文章量を削減してはいけません');
for (const [index, match] of chartDescriptions.entries()) {
  const text = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  assert(Array.from(text).length >= 320, `洞察・考察${index + 1}の文章量を短縮してはいけません`);
}

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());
for (const script of scripts) new Function(script);

console.log('ダッシュボードの本サイト同期・既存洞察文保持の回帰テストに合格しました。');
console.log(JSON.stringify({
  news: newsData.length,
  columns: colData.length,
  total: newsData.length + colData.length,
  totalChars: totalNewsChars + totalColChars,
  latestNews: newsData[0].id,
  latestColumn: colData[0].id,
  chartNarratives: chartDescriptions.length,
  chartNarrativeCharacters: Array.from(chartNarrativeText).length,
  legacyNarrativesPreserved: true,
}, null, 2));
