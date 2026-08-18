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
assert.strictEqual(totalNewsChars, 81224, 'ニュース本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalColChars, 50913, 'コラム本文総文字数を本サイトと一致させる必要があります');
assert.strictEqual(totalNewsChars + totalColChars, 132137, '総文字数を本サイトと一致させる必要があります');

assert(html.includes('id="print-total-summary"'), '印刷概要の収録件数を動的に表示する必要があります');
assert(html.includes('id="print-period-summary"'), '印刷概要の期間を動的に表示する必要があります');
assert(html.includes('id="csv-article-count"'), 'CSVの全記事件数を動的に表示する必要があります');
assert(html.includes('id="dynamic-summary"'), '包括分析を最新データから生成する必要があります');
assert(html.includes('DASHBOARD_SYNC_NARRATIVES_START'), 'グラフ説明を同期データから生成する必要があります');
assert(html.includes("document.querySelectorAll('.chart-card')"), '全グラフの説明を同期対象とする必要があります');
assert(!html.includes('天命乃杜 — 246日間の軌跡が語るもの'), '旧データに固定された包括分析を残してはいけません');
assert(!html.includes('147本・128,040字・246日間'), '旧データに固定された結語を残してはいけません');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter((script) => script.trim());
for (const script of scripts) new Function(script);

console.log('ダッシュボードの本サイト同期・動的分析文の回帰テストに合格しました。');
console.log(JSON.stringify({
  news: newsData.length,
  columns: colData.length,
  total: newsData.length + colData.length,
  totalChars: totalNewsChars + totalColChars,
  latestNews: newsData[0].id,
  latestColumn: colData[0].id,
  dynamicNarratives: true,
}, null, 2));
