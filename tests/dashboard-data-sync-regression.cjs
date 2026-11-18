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
  assert(length >= 60 && length <= 105, 'コラムID' + article.id + 'の一覧説明は70〜105字である必要があります（' + length + '字）');
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

const chartDescriptions = [...html.matchAll(/<div class="chart-desc"><div class="chart-desc-title">▍ 洞察・考察<\/div><p class="chart-desc-copy">([\s\S]*?)<\/p><\/div>/g)];
assert.strictEqual(chartDescriptions.length, 41, '既存38個の説明に加え、新規3グラフの考察を維持する必要があります');
const chartNarrativeText = chartDescriptions
  .map((match) => match[1].replace(/<strong class="chart-insight-label">[^<]*<\/strong>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ''))
  .join('');
const descriptionLengths = chartDescriptions.map((match) =>
  Array.from(match[1].replace(/<strong class="chart-insight-label">[^<]*<\/strong>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '')).length
);
const originalDescriptionMinimums = [432, 406, 503, 373, 435, 435, 371, 375, 404, 399, 413, 410, 395, 421, 363, 369, 432, 458, 411, 428, 469, 489, 456, 456, 482, 472, 482, 491, 436, 440, 449, 447, 477, 437, 442, 345, 407, 393];
assert.strictEqual(originalDescriptionMinimums.length, 38, '既存説明文の基準文字数を38件保持します');
assert(descriptionLengths.slice(0, 38).every((length, index) => length >= originalDescriptionMinimums[index]), '既存38件の洞察・考察本文を一文字も短縮しません');
assert(descriptionLengths.slice(38).every((length) => length >= 340 && length <= 520), '新規グラフの考察文も既存と同程度の文章量に揃えます');
assert(Array.from(chartNarrativeText).length >= 16000, '全グラフの考察総文字数を維持する必要があります');
assert((html.match(/▍ 洞察・考察/g) || []).length === 41, '説明欄の見出しを全41件で統一する必要があります');
assert((html.match(/class="chart-insight-label"/g) || []).length === 123, '全41件の考察を「指標の概要・主な傾向・解釈上の注意」の三段構成に統一します');
for (const id of ['chart-title-body-scatter', 'chart-day-of-month', 'chart-title-length']) {
  assert(html.includes('id="' + id + '"'), '追加グラフの描画領域が必要です: ' + id);
}
assert(html.includes("chart: chartTitleBodyScatter") && html.includes("chart: chartDayOfMonth") && html.includes("chart: chartTitleLength"), '追加グラフを共通リサイズ・操作対象へ登録します');

const styleBlocks = [...html.matchAll(/<style\b/gi)];
assert.strictEqual(styleBlocks.length, 1, 'スタイルシートは一つに統合する必要があります');
assert(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*400px\),\s*1fr\)\)\s*!important/.test(html), '未使用列を折りたたみ、最終行のグラフも横幅いっぱいに広げます');
assert(/@media\s*\(max-width:\s*640px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/.test(html), 'スマートフォンではグラフを一列に配置します');
assert(/\.chart-card\s*,\s*\.advanced-chart-card\s*\{[\s\S]*?width:\s*100%\s*!important/.test(html), 'グラフカードは親グリッドの横幅を使い切ります');
assert(/\.chart-card\s*>\s*\.chart-box[\s\S]*?width:\s*100%\s*!important/.test(html), 'EChartsの描画領域はカード幅に追従します');
assert(/const dashboardChartFont = "'Zen Kaku Gothic New', sans-serif";/.test(html), 'グラフ内の書体をサイトUIと統一する必要があります');
assert(!html.includes('#c0392b') && !html.includes('#8b7355') && !html.includes('#d4c4a0'), '旧配色を残さない必要があります');
assert(!html.includes('chartDescriptionCopy') && !html.includes('chart-desc-auto'), '短文で長文説明を上書きする処理を残しません');

assert(html.includes('GitHub本体リポジトリ確認基準：2026-11-18 · b021ef42'), '本体リポジトリの確認コミットを最新に保ちます');

assert(html.includes('.subtitle{font-family:var(--font-main);font-style:italic;color:var(--tm-muted)}'), '副題は本体サイトと同じ明朝の編集見出しにします');
assert(html.includes('.stat-number{color:var(--stat-accent,var(--tm-red))!important;font-family:var(--font-ui);'), '統計数値はUI書体と等幅数字で揃えます');
assert(!html.includes('2026年11月18日07:12:07 UTC'), '本文中の時刻表記は日本語に統一します');

assert(!html.includes('181e5b3d') && !html.includes('partial') && !html.includes('outage') && !html.includes('operational'), '古い監視状態の文言を残しません');
assert(html.includes('記事文字数の経験累積分布（ECDF）'), 'ECDFのグラフ名は日本語を主表記にします');
assert(!/#([0-9a-fA-F]{9,})\b/.test(html), '不正な9桁以上の16進カラー値を残しません');

const rgbaValues = [...new Set(html.match(/rgba\([^)]*\)/gi) || [])];
const allowedRgbaPrefixes = ['rgba(48,41,35,', 'rgba(143,37,43,', 'rgba(196,160,89,', 'rgba(247,242,237,', 'rgba(255,253,251,'];
assert(rgbaValues.every((value) => allowedRgbaPrefixes.some((prefix) => value.toLowerCase().startsWith(prefix))), '透過色も共通パレットに統一します');
const syncScript = fs.readFileSync('scripts/sync-tenmei-data.mjs', 'utf8');
assert(syncScript.includes('chart-desc-copy'), '自動同期は説明文の段落構造を正しく保護します');

assert(html.includes('<p class="chart-desc-copy">'), '洞察・考察は共通段落構造を維持します');

const inlineScriptMatch = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find((match) => match[2].includes('const newsData = ['));
assert(inlineScriptMatch, '記事データを含むスクリプトが必要です');
assert(!/\sstyle="/.test(html.slice(0, inlineScriptMatch.index)), '静的HTMLに個別のインラインスタイルを残しません');

const remainingStyleAttributes = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((match) => match[1]);
assert.strictEqual(remainingStyleAttributes.length, 2, '動的なデータ色・進捗幅以外のインラインスタイルを残しません');
assert(remainingStyleAttributes.some((value) => value.startsWith('--bar-width:')) && remainingStyleAttributes.some((value) => value.startsWith('--tag-color:')), '残すインライン値はデータ由来のCSS変数だけにします');

const approvedPalette = new Set([
  '#302923', '#8f252b', '#c4a059', '#d5b16b', '#55443a', '#786e67',
  '#f7f2ed', '#e7ded7', '#718b7b', '#7188a4', '#8b7898', '#ead8c8',
  '#9b793d', '#5f1717', '#89631f', '#fffdfb', '#302923dd', '#302923ee'
]);
const usedColors = [...new Set([...html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0].toLowerCase()))];
assert(usedColors.every((color) => approvedPalette.has(color)), '色は天命乃杜の統一パレット内に収めます');
assert(html.includes('.char-bar__track') && html.includes('.char-bar__fill'), '文字数バーを共通コンポーネントで描画します');
assert(html.includes('style="--tag-color:\${color}"'), 'タグ色は共通バッジのCSS変数で渡します');
assert(!chartNarrativeText.includes('Treemap') && !chartNarrativeText.includes('ThemeRiver') && !chartNarrativeText.includes('Pareto'), 'グラフ説明の専門用語は日本語表記に統一します');


const summaryStart = html.indexOf('  <!-- MEGA SUMMARY -->');
const summaryEnd = html.indexOf('  <!-- ARTICLE TABLES -->', summaryStart);
assert(summaryStart >= 0 && summaryEnd > summaryStart, '総合分析本文が必要です');
const summaryText = html.slice(summaryStart, summaryEnd).replace(/<[^>]+>/g, '').replace(/\s+/g, '');
assert(Array.from(summaryText).length >= 3000, '総合分析本文の文章量を維持する必要があります');


/* Layout regression: no lone chart or unpaired final chart may leave an empty right column. */
assert(/\.charts-grid > \.chart-card:only-child[\s\S]*?grid-column:\s*1\s*\/\s*-1\s*!important/.test(html), '単独グラフはカードを全幅に広げます');
assert(/\.charts-grid > \.chart-card\.heatmap-card[\s\S]*?grid-column:\s*1\s*\/\s*-1\s*!important/.test(html), 'ヒートマップは全幅で配置します');
assert(/\.charts-grid > \.chart-card:last-child:nth-child\(odd\)/.test(html), '奇数個のグラフ群で最後のカードを全幅にします');
assert(/id="chart-advanced-radar"[^<]*|class="chart-card advanced-chart-card advanced-chart-wide"[\s\S]*?id="chart-advanced-radar"/.test(html), '詳細分析の最後のレーダー図は全幅で行を埋めます');
assert(/\.advanced-charts-grid:not\(\.advanced-charts-grid-extra\) > \.advanced-chart-card:last-child[\s\S]*?grid-column:\s*1\s*\/\s*-1\s*!important/.test(html), '詳細分析の最初のグループで右側の空白列を作りません');


assert(/class="chart-card advanced-chart-card advanced-chart-wide"[\s\S]{0,500}id="chart-advanced-lengthband"/.test(html), '長さ帯比較は次の全幅グラフの前で空白列を作らないよう全幅にします');
assert(/class="chart-card advanced-chart-card advanced-chart-wide"[\s\S]{0,500}id="chart-advanced-intensity"/.test(html), '活動日あたりの記事数は次の全幅ECDFの前で空白列を作らないよう全幅にします');

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
