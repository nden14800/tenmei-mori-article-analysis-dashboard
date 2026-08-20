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

assert.strictEqual(newsData.length, 87, '社務所だよりは本サイトの最新87件と一致する必要があります');
assert.strictEqual(colData.length, 62, '神籤草子は本サイトの最新62件と一致する必要があります');
assert.strictEqual(newsData[0].id, 87, 'Ver.4.0社務所だよりを最新ニュースとして含める必要があります');
assert.strictEqual(newsData[0].date, '2026/08/17', 'Ver.4.0社務所だよりの日付を保持する必要があります');
assert.strictEqual(newsChars['87'], 4022, 'Ver.4.0社務所だよりの本文文字数を本サイトと一致させる必要があります');
assert.strictEqual(newsData[0].title, '【UI/UX大規模刷新】Ver.4.0「静謐な即応」— 天命乃杜の全画面を新たな意匠へ統一しました', 'Ver.4.0社務所だよりの最新タイトルを本サイトと一致させる必要があります');
assert.strictEqual(newsData[0].tag, '新機能・改善', 'Ver.4.0社務所だよりのタグを本サイトと一致させる必要があります');

assert.strictEqual(colData[0].id, 62, '処暑コラムを最新神籤草子として追加する必要があります');
assert.strictEqual(colData[0].date, '2026/08/20', '処暑コラムの日付を本サイトと一致させる必要があります');
assert.strictEqual(colData[0].category, '干支・暦', '処暑コラムのカテゴリを本サイトと一致させる必要があります');
assert.strictEqual(colData[0].title, '【干支・暦】今週日曜は処暑——暑さの向こうに、秋の気配を待つ二十四節気', '処暑コラムのタイトルを本サイトと一致させる必要があります');
assert.strictEqual(colData[0].desc, '二十四節気「処暑」が示す季節の意味を紹介します。2026年の節入り日時、三つの七十二候、残暑と台風期に心に留めたい神社参拝の考え方を、暮らしの目線で丁寧に解説します。', '処暑コラムの一覧説明を本サイトと一致させる必要があります');

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
assert.strictEqual(colChars['62'], 1241, '処暑コラムの本文文字数を本サイトのDOM計算と一致させる必要があります');
assert.strictEqual(totalNewsChars, 81224, 'ニュース本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalColChars, 52176, 'コラム本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalNewsChars + totalColChars, 133400, '総文字数を本サイトと一致させる必要があります');

assert(html.includes('<dd id="print-total-summary">149記事・133,400字</dd>'), '印刷概要の収録件数と文字数を最新値へ更新する必要があります');
assert(html.includes('<dd id="print-period-summary">2025年12月10日〜2026年8月20日（254日間）</dd>'), '印刷概要の期間を最新値へ更新する必要があります');
assert(html.includes('<option id="csv-article-count" value="articles">全記事データ（149件）</option>'), 'CSVの全記事件数を最新値へ更新する必要があります');
assert((html.match(/<th>内容（抜粋）<\/th>/g) || []).length === 2, '社務所だよりと神籤草子の説明列は同じ「内容（抜粋）」表記へ統一する必要があります');
assert(html.includes('<td class="desc-cell">${a.desc}</td>'), '神籤草子の一覧説明を全件表示する必要があります');
assert(html.includes('colspan="6" class="no-results"'), '神籤草子一覧の説明列追加後も検索結果なしの表示列数を整合させる必要があります');

const requiredNarrativeHeadings = [
  '天命乃杜 — 254日間の軌跡が語るもの',
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
  '全149記事（ニュース87本＋コラム62本）を文字数に基づいて',
  'ミドルクラスが過半数（約54%・81本）を占め、次いでショートが約21%（31本）、ロングが約25%（37本）',
  '62本のコラム記事（神籤草子）に付与されたカテゴリの分布だ。',
  '8月20日時点で合計149記事に到達している。',
  '総文字数は133,400字に達しており',
  '神籤草子62本の投稿曜日の分布だ。',
  '8月20日の処暑コラムまで記録している。',
  '8月20日には二十四節気「処暑」を扱うコラムが加わっている。',
  '149本・133,400字・254日間・4回のDBマイグレーション',
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
