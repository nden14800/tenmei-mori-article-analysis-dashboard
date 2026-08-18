const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

function extractArray(variableName) {
  const declaration = new RegExp(`\\bconst\\s+${variableName}\\s*=`).exec(html);
  assert(declaration, `${variableName} declaration is missing`);
  const openIndex = html.indexOf('[', declaration.index);
  assert.notStrictEqual(openIndex, -1, `${variableName} array start is missing`);

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
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return vm.runInNewContext(`(${html.slice(openIndex, index + 1)})`, Object.create(null));
      }
    }
  }
  throw new Error(`${variableName} array end is missing`);
}

function extractObject(variableName) {
  const declaration = new RegExp(`\\bconst\\s+${variableName}\\s*=`).exec(html);
  assert(declaration, `${variableName} declaration is missing`);
  const openIndex = html.indexOf('{', declaration.index);
  assert.notStrictEqual(openIndex, -1, `${variableName} object start is missing`);
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
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return vm.runInNewContext(`(${html.slice(openIndex, index + 1)})`, Object.create(null));
    }
  }
  throw new Error(`${variableName} object end is missing`);
}

const newsData = extractArray('newsData');
const colData = extractArray('colData');
const newsChars = extractObject('newsChars');
const colChars = extractObject('colChars');
const totalNewsChars = Object.values(newsChars).reduce((sum, value) => sum + value, 0);
const totalColChars = Object.values(colChars).reduce((sum, value) => sum + value, 0);

assert.strictEqual(newsData.length, 87, '社務所だよりは本サイトの最新87件と一致する必要があります');
assert.strictEqual(colData.length, 61, '神籤草子は本サイトの最新61件と一致する必要があります');
assert.strictEqual(newsData[0].id, 87, 'Ver.4.0社務所だよりを最新記事として含める必要があります');
assert.strictEqual(newsData[0].date, '2026/08/17', 'Ver.4.0社務所だよりの日付を保持する必要があります');
assert.strictEqual(newsChars['87'], 4022, 'Ver.4.0社務所だよりの本文文字数を本サイトと一致させる必要があります');
assert.strictEqual(colData[0].id, 61, '最新神籤草子を保持する必要があります');
assert.strictEqual(colChars['61'], 1280, '最新神籤草子の本文文字数を本サイトと一致させる必要があります');
assert.strictEqual(colData.length, 61, '神籤草子の一覧説明は全61件に保持する必要があります');
for (const article of colData) {
  const length = Array.from(article.desc || '').length;
  assert(article.desc && article.desc.trim(), `神籤草子ID${article.id}の一覧説明が不足しています`);
  assert(length >= 70 && length <= 105, `神籤草子ID${article.id}の一覧説明は70〜105字である必要があります（${length}字）`);
}
assert.strictEqual(colData.find((article) => article.id === 61).desc, 'お盆に神社へ参拝してよいか迷う方向けの記事です。忌中の扱いや普段の作法、先祖を想う心を大切にする具体的な参拝の注意点と、地域差や氏神への相談の勧めも含めて説明します。', '最新神籤草子の一覧説明を本サイトと一致させる必要があります');
assert.strictEqual(totalNewsChars, 81224, 'ニュース本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalColChars, 50913, 'コラム本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalNewsChars + totalColChars, 132137, '総文字数を本サイトと一致させる必要があります');

assert(html.includes('<dd id="print-total-summary">148記事・132,137字</dd>'), '印刷概要の収録件数を最新値へ更新する必要があります');
assert(html.includes('<dd id="print-period-summary">2025年12月10日〜2026年8月17日（251日間）</dd>'), '印刷概要の期間を最新値へ更新する必要があります');
assert(html.includes('<option id="csv-article-count" value="articles">全記事データ（148件）</option>'), 'CSVの全記事件数を最新値へ更新する必要があります');
assert((html.match(/<th>内容（抜粋）<\/th>/g) || []).length === 2, '社務所だよりと神籤草子の説明列は同じ「内容（抜粋）」表記へ統一する必要があります');
assert(html.includes('<td class="desc-cell">${a.desc}</td>'), '神籤草子の一覧説明を全件表示する必要があります');
assert(html.includes('colspan="6" class="no-results"'), '神籤草子一覧の説明列追加後も検索結果なしの表示列数を整合させる必要があります');
assert(html.includes('天命乃杜 — 251日間の軌跡が語るもの'), '過去コミットの包括分析の見出しを保持する必要があります');
assert(html.includes('▍ フェーズ I — 爆発的始動期（2025年12月〜2026年1月上旬）'), '過去コミットの包括分析・フェーズIを保持する必要があります');
assert(html.includes('▍ フェーズ II — インフラ激動期（2026年1月中旬〜下旬）'), '過去コミットの包括分析・フェーズIIを保持する必要があります');
assert(html.includes('▍ フェーズ III — 成熟・洗練期から長期充電へ（2026年2月〜4月）'), '過去コミットの包括分析・フェーズIIIを保持する必要があります');
assert(html.includes('▍ フェーズ IV — 「本数より質」への転換期（2026年5月〜8月）'), '過去コミットの包括分析・フェーズIVを保持する必要があります');
assert(html.includes('▍ ニュースとコラムの役割分担という戦略的決定'), '過去コミットの媒体分析を保持する必要があります');
assert(html.includes('▍ 開発者の行動リズムが示す持続可能性'), '過去コミットの行動分析を保持する必要があります');
assert(html.includes('▍ 文字数に宿るプロダクト哲学'), '過去コミットの文字数分析を保持する必要があります');
assert(html.includes('▍ 結語 — 数字が証明するもの'), '過去コミットの結語を保持する必要があります');
assert(html.includes('148本・132,137字・251日間・4回のDBマイグレーション'), '包括分析の結語に最新の数値だけを反映する必要があります');
assert(html.includes('「新機能・改善」（平均3,029字、7本）'), 'タグ別考察の文章を保持し、最新の数値だけを反映する必要があります');
assert(html.includes('全148記事（ニュース87本＋コラム61本）を文字数に基づいて'), '記事長クラスの考察本文で最新件数を表示する必要があります');
assert(html.includes('ミドルクラスが過半数（約55%・81本）を占め、次いでショートが約21%（31本）、ロングが約24%（36本）'), '記事長クラスの考察本文で最新分布を表示する必要があります');
assert(html.includes('8月17日時点で合計148記事に到達している。'), '累積記事数の考察本文で最新到達点を表示する必要があります');
assert(html.includes('総文字数は132,137字に達しており'), '累積文字数の考察本文で最新総文字数を表示する必要があります');
assert(html.includes('ニュース記事87本の投稿時刻'), '投稿時刻の考察本文で最新ニュース件数を表示する必要があります');
assert(html.includes('ID87（2026年8月）のVer.4.0記事は4,022字を記録しており'), '文字数散布図の考察本文で最新記事を表示する必要があります');
assert(html.includes('新機能・改善」（平均約3,029字、7本）'), '相関分析の考察本文で最新タグ値を表示する必要があります');
assert(html.includes('8月17日のVer.4.0大型更新まで記録している。'), '日別投稿考察に最新更新を追加する必要があります');
assert(!html.includes('DASHBOARD_SYNC_NARRATIVES_START'), '既存の洞察・考察本文を動的な短文で置き換えてはいけません');
assert(!html.includes('id="dynamic-summary"'), '包括分析の既存本文を削除してはいけません');
assert((html.match(/class="chart-desc"/g) || []).length >= 20, 'グラフごとの洞察・考察本文を維持する必要があります');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter((script) => script.trim());
for (const script of scripts) new Function(script);

console.log('ダッシュボードの本サイト同期・既存洞察文保持の回帰テストに合格しました。');
console.log(JSON.stringify({
  news: newsData.length,
  columns: colData.length,
  total: newsData.length + colData.length,
  totalChars: totalNewsChars + totalColChars,
  latestNews: newsData[0].id,
  latestColumn: colData[0].id,
  legacyNarrativesPreserved: true,
}, null, 2));
