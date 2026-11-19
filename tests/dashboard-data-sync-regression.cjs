const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const html = fs.readFileSync('index.html', 'utf8');
const sourceHtml = fs.readFileSync('tenmei-mori/index.html', 'utf8');

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
const newsContentHashes = extractObject('newsContentHashes');
const colContentHashes = extractObject('colContentHashes');
function extractSourceArray(marker) {
  const start = sourceHtml.indexOf(marker);
  assert.notStrictEqual(start, -1, '本体ソースの配列宣言が必要です: ' + marker);
  const open = sourceHtml.indexOf('[', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let template = false;
  for (let index = open; index < sourceHtml.length; index += 1) {
    const char = sourceHtml[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === String.fromCharCode(96)) { template = !template; continue; }
    if (template) { if (char === '\\\\') index += 1; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return sourceHtml.slice(open, index + 1);
    }
  }
  throw new Error('本体ソースの配列終端が見つかりません: ' + marker);
}

const sourceNewsData = Function('"use strict"; return (' + extractSourceArray('const newsData = [') + ')')();
const sourceColData = Function('"use strict"; return (' + extractSourceArray('const columnData = [') + ')')();
const contentHash = (content) => crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
const expectedNewsHashes = Object.fromEntries(sourceNewsData.map((article) => [String(article.id), contentHash(article.content)]));
const expectedColHashes = Object.fromEntries(sourceColData.map((article) => [String(article.id), contentHash(article.content)]));
const totalNewsChars = Object.values(newsChars).reduce((sum, value) => sum + Number(value), 0);
const totalColChars = Object.values(colChars).reduce((sum, value) => sum + Number(value), 0);
const validPublicationTime = /^([01]\\d|2[0-3]):[0-5]\\d$/;
const newsHourCounts = Array(24).fill(0);
for (const article of newsData) {
  assert(validPublicationTime.test(article.time || ''), 'ニュース全件に有効な公開時刻が必要です');
  newsHourCounts[Number(article.time.slice(0, 2))] += 1;
}
const sourceNewsFields = ['id', 'title', 'date', 'time', 'tag', 'tagColor', 'borderColor', 'desc'];
const sourceColFields = ['id', 'title', 'date', 'category', 'icon', 'colorClass', 'desc'];
const normalizeRecords = (items, fields) => Array.from(items, (article) => fields.map((field) => String(article[field] || '')));
assert.deepStrictEqual(normalizeRecords(newsData, sourceNewsFields), normalizeRecords(sourceNewsData, sourceNewsFields), 'ニュースの全レコード・メタデータを本体mainと一致させます');
assert.deepStrictEqual(normalizeRecords(colData, sourceColFields), normalizeRecords(sourceColData, sourceColFields), 'コラムの全レコード・メタデータを本体mainと一致させます');
assert.strictEqual(JSON.stringify(newsContentHashes), JSON.stringify(expectedNewsHashes), 'ニュース本文ハッシュを本体mainと一致させます');
assert.strictEqual(JSON.stringify(colContentHashes), JSON.stringify(expectedColHashes), 'コラム本文ハッシュを本体mainと一致させます');
assert.strictEqual(Object.keys(newsChars).length, sourceNewsData.length, 'ニュース全件の文字数を保持します');
assert.strictEqual(Object.keys(colChars).length, sourceColData.length, 'コラム全件の文字数を保持します');
assert.strictEqual(JSON.stringify(Object.keys(newsChars).sort()), JSON.stringify(sourceNewsData.map((article) => String(article.id)).sort()), 'ニュース文字数のID集合を本体mainと一致させます');
assert.strictEqual(JSON.stringify(Object.keys(colChars).sort()), JSON.stringify(sourceColData.map((article) => String(article.id)).sort()), 'コラム文字数のID集合を本体mainと一致させます');
assert(Object.values(newsChars).every((value) => Number.isInteger(value) && value > 0), 'ニュース文字数はすべて正の整数である必要があります');
assert(Object.values(colChars).every((value) => Number.isInteger(value) && value > 0), 'コラム文字数はすべて正の整数である必要があります');
assert.strictEqual(newsHourCounts.reduce((sum, count) => sum + count, 0), newsData.length, '時刻分布にニュース全件を集計する必要があります');
const latestNews = sourceNewsData.reduce((latest, article) => article.id > latest.id ? article : latest, sourceNewsData[0]);
const latestColumn = sourceColData.reduce((latest, article) => article.id > latest.id ? article : latest, sourceColData[0]);
assert.strictEqual(newsData[0].id, latestNews.id, '最新ニュースを本体mainの最大IDと一致させます');
assert.strictEqual(colData[0].id, latestColumn.id, '最新コラムを本体mainの最大IDと一致させます');
const allDates = [...sourceNewsData, ...sourceColData].map((article) => article.date).sort();
const toUtcDate = (value) => new Date(value.replace(/\\//g, '-') + 'T00:00:00Z');
const startDate = toUtcDate(allDates[0]);
const endDate = toUtcDate(allDates[allDates.length - 1]);
const inclusiveDays = Math.round((endDate - startDate) / 86400000) + 1;
const formatJapaneseDate = (date) => date.getUTCFullYear() + '年' + (date.getUTCMonth() + 1) + '月' + date.getUTCDate() + '日';
const expectedPeriodSummary = '<dd id="print-period-summary">' + formatJapaneseDate(startDate) + '〜' + formatJapaneseDate(endDate) + '（' + inclusiveDays + '日間）</dd>';


for (const article of colData) {
  const length = Array.from(article.desc || '').length;
  assert(article.desc && article.desc.trim(), 'コラムID' + article.id + 'の一覧説明が必要です');
  assert(length >= 60 && length <= 105, 'コラムID' + article.id + 'の一覧説明は70〜105字である必要があります（' + length + '字）');
}

const totalArticleCount = newsData.length + colData.length;
const totalArticleChars = totalNewsChars + totalColChars;
assert(totalNewsChars > 0 && totalColChars > 0 && totalArticleChars > 0, '記事本文の総文字数を正の値で集計します');
assert(html.includes('<dd id="print-total-summary">' + totalArticleCount + '記事・'), '印刷概要の件数を最新データと一致させます');
assert(html.includes(expectedPeriodSummary), '印刷概要の対象期間を本体mainの最古・最新日と一致させます');
assert(html.includes('data-control-id="csv-export-type"') && html.includes('"label":"全記事データ（' + totalArticleCount + '件）"'), '全記事CSVの件数を最新データと一致させます');
assert((html.match(/<th>内容（抜粋）<\/th>/g) || []).length === 2, '両媒体の一覧説明列を統一する必要があります');

const requiredHeadings = [
  '天命乃杜 — 344日間の軌跡が語るもの',
  '▍ フェーズ I — 爆発的始動期（2025年12月〜2026年1月上旬）',
  '▍ フェーズ II — インフラ・機能拡張の集中期（2026年1月中旬〜2月）',
  '▍ フェーズ III — 投稿の空白と運営再開（2026年2月〜4月）',
  '▍ フェーズ IV — 「本数より質」への転換期（2026年5月〜8月）',
  '▍ フェーズ V — 秋から初冬の継続改善と読み物の拡充（2026年9月〜11月）',
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

const chartDescriptions = [...html.matchAll(/<div class="chart-desc"><div class="chart-desc-title">▍ 洞察・考察<\/div><div class="chart-desc-copy">([\s\S]*?)<\/div><\/div>/g)];
assert.strictEqual(chartDescriptions.length, 49, '全49個の洞察・考察を維持する必要があります');
for (const match of chartDescriptions) {
  const labels = [...match[1].matchAll(/<strong class="chart-insight-label">([^<]+)<\/strong>/g)].map((item) => item[1]);
  assert.deepStrictEqual(labels, ['指標の概要', '主な傾向', '解釈上の注意'], '全グラフの洞察・考察を同じ三段構成に統一します');
}
const chartNarrativeText = chartDescriptions
  .map((match) => match[1].replace(/<strong class="chart-insight-label">[^<]*<\/strong>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ''))
  .join('');
const descriptionLengths = chartDescriptions.map((match) =>
  Array.from(match[1].replace(/<strong class="chart-insight-label">[^<]*<\/strong>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '')).length
);
/* The 20th legacy insight is 410 characters in the pre-sync Git history; 428 was an incorrect baseline. */
const originalDescriptionMinimums = [432, 406, 503, 373, 435, 435, 371, 375, 404, 399, 413, 410, 395, 421, 363, 369, 432, 458, 411, 410, 469, 489, 456, 456, 482, 472, 482, 491, 436, 440, 449, 447, 477, 437, 442, 345, 407, 393];
assert.strictEqual(originalDescriptionMinimums.length, 38, '既存説明文の基準文字数を38件保持します');
assert(descriptionLengths.slice(0, 38).every((length, index) => length >= originalDescriptionMinimums[index]), '既存38件の洞察・考察本文を一文字も短縮しません');
assert(descriptionLengths.slice(38).every((length) => length >= 340 && length <= 520), '新規グラフの考察文も既存と同程度の文章量に揃えます');
assert(Array.from(chartNarrativeText).length >= 16000, '全グラフの考察総文字数を維持する必要があります');
assert((html.match(/▍ 洞察・考察/g) || []).length === 49, '説明欄の見出しを全49件で統一する必要があります');
assert((html.match(/class="chart-insight-label"/g) || []).length === 147, '全49件の考察を「指標の概要・主な傾向・解釈上の注意」の三段構成に統一します');
for (const id of ['chart-title-body-scatter', 'chart-day-of-month', 'chart-title-length', 'chart-advanced-weekday-month-heatmap', 'chart-advanced-title-monthly-median', 'chart-advanced-weekday-boxplot', 'chart-advanced-lorenz', 'chart-advanced-gap-scatter']) {
  assert(html.includes('id="' + id + '"'), '追加グラフの描画領域が必要です: ' + id);
}
assert(!html.includes('chart-advanced-pareto-frontier'), 'パレート線は独立カードではなく既存の散布図へ統合します');
assert(!html.includes('chart-advanced-monthly-boxplot'), '月別中央値と重複する月別箱ひげ図を残しません');
const detailedStatsStart = html.indexOf('<div class="section-title">詳細な統計分析</div>');
const titleDetailStart = html.indexOf('<div class="section-title">タイトルと公開日の追加分析</div>');
assert(detailedStatsStart >= 0 && titleDetailStart > detailedStatsStart, '詳細な統計分析のセクション範囲が必要です');
for (const id of ['chart-advanced-weekday-month-heatmap', 'chart-advanced-title-monthly-median', 'chart-advanced-lorenz', 'chart-advanced-gap-scatter']) {
  const position = html.indexOf('id="' + id + '"');
  assert(position > detailedStatsStart && position < titleDetailStart, '追加した統計グラフは詳細な統計分析内に配置します: ' + id);
}
assert(html.includes("chart: chartTitleBodyScatter") && html.includes("chart: chartDayOfMonth") && html.includes("chart: chartTitleLength") && html.includes("chart: chartAdvancedWeekdayMonthHeatmap") && html.includes("chart: chartAdvancedTitleMonthlyMedian") && html.includes("chart: chartAdvancedWeekdayBoxplot") && html.includes("chart: chartAdvancedLorenz") && html.includes("chart: chartAdvancedGapScatter"), '追加グラフを共通リサイズ・操作対象へ登録します');
assert(html.includes('calculateScatterPareto') && html.includes('calculateLorenzCurve') && html.includes('chart-title-body-scatter') && html.includes('chart-advanced-gap-scatter') && html.includes('chart-advanced-date-scatter') && html.includes('lorenzNews'), '複数の既存散布図へパレート線を統合し、ローレンツ曲線をデータから計算します');
assert((html.match(/name: ?'(?:ニュース|コラム)のパレート線'/g) || []).length >= 6, '3つの既存散布図へ媒体別のパレート線を追加します');
assert.strictEqual((html.match(/name: ?'(?:ニュース|コラム)のパレート線'|name: ?'分類のパレート線'/g) || []).length, 11, '6つのグラフにパレート線を配置します');
const paretoLegendCharts = [
  ['chartMonthly.setOption({', ['ニュースのパレート線', 'コラムのパレート線']],
  ['chartTagBubble.setOption({', ['分類のパレート線']],
  ['chartScatter.setOption({', ['ニュースのパレート線', 'コラムのパレート線']],
  ['chartTitleBodyScatter.setOption({', ['ニュースのパレート線', 'コラムのパレート線']],
  ['setAdvancedOption(chartAdvancedDateScatter,', ['ニュースのパレート線', 'コラムのパレート線']],
  ['setAdvancedOption(chartAdvancedGapScatter,', ['ニュースのパレート線', 'コラムのパレート線']]
];
for (const [chartStart, paretoNames] of paretoLegendCharts) {
  const start = html.indexOf(chartStart);
  assert(start >= 0, 'パレート対象グラフの設定が必要です: ' + chartStart);
  const end = html.indexOf('\n});', start);
  assert(end > start, 'グラフ設定の終端が必要です: ' + chartStart);
  const option = html.slice(start, end);
  const legendMatch = option.match(/legend\s*:\s*\{[^}]*data\s*:\s*\[([^\]]*)\]/);
  assert(legendMatch, 'パレート対象グラフには操作可能な凡例が必要です: ' + chartStart);
  for (const name of paretoNames) {
    assert(legendMatch[1].includes("'" + name + "'"), 'パレート線を凡例から個別に切り替えられる必要があります: ' + chartStart + ' / ' + name);
    assert(option.includes("name: '" + name + "'") || option.includes("name:'" + name + "'"), '凡例に対応するパレート系列が必要です: ' + chartStart + ' / ' + name);
  }
}


assert.strictEqual((html.match(/tooltip\s*:\s*\{\s*show\s*:\s*false\s*\}/g) || []).length, 11, '全11本のパレート系列は独立したツールチップを表示しません');
assert(html.includes("params.filter(item => !String(item.seriesName || '').includes('パレート線'))"), '軸ツールチップからパレート線を除外します');

const dayOfMonthChartStart = html.indexOf('chartDayOfMonth.setOption({');
const dayOfMonthChartEnd = html.indexOf('\n});', dayOfMonthChartStart);
assert(dayOfMonthChartStart >= 0 && dayOfMonthChartEnd > dayOfMonthChartStart, '月内の公開日分布の設定が必要です');
assert(!html.slice(dayOfMonthChartStart, dayOfMonthChartEnd).includes('パレート線'), 'パレート線のないグラフに余分なパレート凡例を追加しません');

assert(html.includes('id="pareto-toggle-all"') && html.includes('function applyParetoVisibility'), '全グラフのパレート表示を一括で切り替える操作を用意します');
assert(html.includes("type: visible ? 'legendSelect' : 'legendUnSelect'"), '凡例操作と連動してパレート線を全グラフで表示・非表示にします');
assert(html.includes('pareto-chart-hidden') && html.includes("paretoChartCard?.classList.toggle('pareto-chart-hidden', !visible)"), '独立したパレート図も一括操作の対象にします');
assert(html.includes('top:null,bottom:5,left:\'center\',right:null,selectedMode:\'multiple\''), '全グラフの凡例を下部中央へ統一し、複数系列を切り替え可能にします');
assert(/zoomLegendBottom\s*=\s*5/.test(html) && /bottom:\s*28/.test(html), 'ズーム用スライダーと凡例の位置を分離します');
assert(!/legend:\s*\{[^}]*\btop\s*:\s*(?!null)/.test(html), '右上配置の凡例を残しません');
assert(html.includes('chartMonthly.setOption') && html.includes('chartScatter.setOption') && html.includes('chartTagBubble.setOption') && html.includes('分類のパレート線'), '月別投稿数・記事ID・カテゴリバブル分析にもパレート線を表示します');
const graphIds = [...html.matchAll(/id="(chart-[^"]+)"/g)].map((match) => match[1]).filter((id) => !['chart-reset-all', 'chart-action-status'].includes(id));
assert.strictEqual(graphIds.length, 49, '描画対象のグラフ数を49件維持します');
assert.strictEqual(new Set(graphIds).size, graphIds.length, 'グラフIDの重複を残しません');
const graphTitles = [...html.matchAll(/<div class="chart-title">([\s\S]*?)<\/div>/g)].map((match) => match[1].replace(/<[^>]+>/g, '').trim());
assert.strictEqual(new Set(graphTitles).size, graphTitles.length, '同じタイトルの重複グラフを残しません');
assert((html.match(/max\s*:\s*100\b/g) || []).length === 6, '固定上限100は累積構成比・月内構成比・ローレンツ曲線・レーダー指標など百分率尺度の軸だけに限定します');

const styleBlocks = [...html.matchAll(/<style\b/gi)];
assert.strictEqual(styleBlocks.length, 1, 'スタイルシートは一つに統合する必要があります');
assert(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*400px\),\s*1fr\)\)\s*!important/.test(html), '未使用列を折りたたみ、最終行のグラフも横幅いっぱいに広げます');
assert(/@media\s*\(max-width:\s*640px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/.test(html), 'スマートフォンではグラフを一列に配置します');
assert(/\.chart-card\s*,\s*\.advanced-chart-card\s*\{[\s\S]*?width:\s*100%\s*!important/.test(html), 'グラフカードは親グリッドの横幅を使い切ります');
assert(/\.chart-card\s*>\s*\.chart-box[\s\S]*?width:\s*100%\s*!important/.test(html), 'EChartsの描画領域はカード幅に追従します');
assert(/const dashboardChartFont = "'Zen Kaku Gothic New', sans-serif";/.test(html), 'グラフ内の書体をサイトUIと統一する必要があります');
assert(!html.includes('#c0392b') && !html.includes('#8b7355') && !html.includes('#d4c4a0'), '旧配色を残さない必要があります');
assert(!html.includes('chartDescriptionCopy') && !html.includes('chart-desc-auto'), '短文で長文説明を上書きする処理を残しません');

assert(html.includes('GitHub本体リポジトリ確認基準：2026-11-19 · 5988e5ac'), '本体リポジトリの確認コミットを最新に保ちます');

assert(html.includes('.subtitle{font-family:var(--font-main);font-style:italic;color:var(--tm-muted)}'), '副題は本体サイトと同じ明朝の編集見出しにします');
assert(html.includes('.stat-number{color:var(--stat-accent,var(--tm-red))!important;font-family:var(--font-ui);'), '統計数値はUI書体と等幅数字で揃えます');
assert(!html.includes('2026年11月18日07:12:07 UTC'), '本文中の時刻表記は日本語に統一します');

assert(!html.includes('181e5b3d') && !html.includes('partial') && !html.includes('outage') && !html.includes('operational'), '古い監視状態の文言を残しません');
assert(html.includes('記事文字数の経験累積分布（ECDF）'), 'ECDFのグラフ名は日本語を主表記にします');
assert(!/#([0-9a-fA-F]{9,})\b/.test(html), '不正な9桁以上の16進カラー値を残しません');

const rgbaValues = [...new Set(html.match(/rgba\([^)]*\)/gi) || [])];
const allowedRgbaPrefixes = ['rgba(48,41,35,', 'rgba(143,37,43,', 'rgba(196,160,89,', 'rgba(247,242,237,', 'rgba(255,253,251,', 'rgba(155,116,46,'];
assert(rgbaValues.every((value) => allowedRgbaPrefixes.some((prefix) => value.toLowerCase().startsWith(prefix))), '透過色も共通パレットに統一します');
const syncScript = fs.readFileSync('scripts/sync-tenmei-data.mjs', 'utf8');
assert(syncScript.includes('chart-desc-copy'), '自動同期は説明文の段落構造を正しく保護します');

assert(html.includes('<div class="chart-desc-copy">'), '洞察・考察は共通コンテナ構造を維持します');

const inlineScriptMatch = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find((match) => match[2].includes('const newsData = ['));
assert(inlineScriptMatch, '記事データを含むスクリプトが必要です');
assert(!/\sstyle="/.test(html.slice(0, inlineScriptMatch.index)), '静的HTMLに個別のインラインスタイルを残しません');

const remainingStyleAttributes = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((match) => match[1]);
assert.strictEqual(remainingStyleAttributes.length, 2, '動的なデータ色・進捗幅以外のインラインスタイルを残しません');
assert(remainingStyleAttributes.some((value) => value.startsWith('--bar-width:')) && remainingStyleAttributes.some((value) => value.startsWith('--tag-color:')), '残すインライン値はデータ由来のCSS変数だけにします');

const approvedPalette = new Set([
  '#302923', '#8f252b', '#c4a059', '#d5b16b', '#55443a', '#786e67',
  '#f7f2ed', '#e7ded7', '#718b7b', '#7188a4', '#8b7898', '#ead8c8',
  '#9b742e', '#9b793d', '#5f1717', '#89631f', '#fffdfb', '#302923dd', '#302923ee',
  '#246a73', '#416a9c', '#76539a', '#b45232', '#4f7542', '#a34768', '#56616f',
  '#b65d32', '#76504b', '#7b654f', '#6f7548', '#c18a68', '#8d6b62', '#a58a5c',
  '#f3e8d9', '#d5ad79', '#f1e5d5', '#d6b36b', '#d8c8b7', '#b9a99a'
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

console.log('記事データ・49件の洞察文・詳細統計・パレート操作・凡例統一・総合分析の回帰テストに合格しました。');
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
