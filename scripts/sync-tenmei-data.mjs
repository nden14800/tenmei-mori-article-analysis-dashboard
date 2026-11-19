import fs from 'node:fs';
import crypto from 'node:crypto';

const SOURCE_FILE = process.env.TENMEI_SOURCE_FILE || '../tenmei-mori/index.html';
const DASHBOARD_FILE = process.env.DASHBOARD_FILE || 'index.html';
const source = fs.readFileSync(SOURCE_FILE, 'utf8');
let dashboard = fs.readFileSync(DASHBOARD_FILE, 'utf8');
const BT = String.fromCharCode(96);

function getArray(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) throw new Error('source marker not found: ' + marker);
  const open = text.indexOf('[', start);
  let depth = 0, quote = null, escaped = false, template = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === BT) { template = !template; continue; }
    if (template) { if (ch === '\\') i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (!depth) return text.slice(open, i + 1); }
  }
  throw new Error('unterminated array: ' + marker);
}

function evalArray(literal) {
  return Function('"use strict"; return (' + literal + ')')();
}

function getObject(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) throw new Error('source marker not found: ' + marker);
  const open = text.indexOf('{', start);
  let depth = 0, quote = null, escaped = false, template = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === BT) { template = !template; continue; }
    if (template) { if (ch === '\\') i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) return text.slice(open, i + 1); }
  }
  throw new Error('unterminated object: ' + marker);
}

const HTML_VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const HTML_NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', mdash: '—', ndash: '–', hellip: '…', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', times: '×', middot: '·', bull: '•', copy: '©', reg: '®', yen: '¥' };
function decodeHtmlEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const codePoint = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      try { return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match; } catch { return match; }
    }
    return HTML_NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
// 本体の countArticleCharacters() と同じ基準でDOM textContent相当を数え、属性・コメント・.ai-image-disclosureを除いて空白を除去する。
function visibleChars(html) {
  const input = String(html || '');
  let text = '';
  const skippedTags = [];
  let index = 0;
  while (index < input.length) {
    if (input[index] !== '<') {
      const nextTag = input.indexOf('<', index);
      const end = nextTag < 0 ? input.length : nextTag;
      if (!skippedTags.length) text += decodeHtmlEntities(input.slice(index, end));
      index = end;
      continue;
    }
    if (input.startsWith('<!--', index)) {
      const commentEnd = input.indexOf('-->', index + 4);
      index = commentEnd < 0 ? input.length : commentEnd + 3;
      continue;
    }
    let tagEnd = index + 1;
    let quote = null;
    for (; tagEnd < input.length; tagEnd += 1) {
      const char = input[tagEnd];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '>') break;
    }
    if (tagEnd >= input.length) {
      if (!skippedTags.length) text += decodeHtmlEntities(input.slice(index));
      break;
    }
    const token = input.slice(index, tagEnd + 1);
    const match = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b([\s\S]*?)>$/i);
    if (match) {
      const closing = Boolean(match[1]);
      const tagName = match[2].toLowerCase();
      const attributes = match[3] || '';
      if (skippedTags.length) {
        if (closing) {
          const lastIndex = skippedTags.lastIndexOf(tagName);
          if (lastIndex >= 0) skippedTags.length = lastIndex;
        } else if (!HTML_VOID_TAGS.has(tagName) && !/\/\s*$/.test(attributes)) {
          skippedTags.push(tagName);
        }
      } else if (!closing) {
        const classMatch = attributes.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const classes = classMatch ? (classMatch[1] ?? classMatch[2] ?? '').split(/\s+/) : [];
        if (classes.includes('ai-image-disclosure') && !HTML_VOID_TAGS.has(tagName) && !/\/\s*$/.test(attributes)) skippedTags.push(tagName);
      }
    }
    index = tagEnd + 1;
  }
  return text.replace(/\s+/g, '').length;
}

const newsSource = evalArray(getArray(source, 'const newsData = ['));
const colSource = evalArray(getArray(source, 'const columnData = ['));
const news = newsSource.map(a => ({id:a.id,title:a.title,date:a.date,time:a.time||'',tag:a.tag||'',tagColor:a.tagColor||'',borderColor:a.borderColor||'',desc:a.desc||'',content:''}));
const cols = colSource.map(a => ({id:a.id,title:a.title,date:a.date,category:a.category||'',icon:a.icon||'',colorClass:a.colorClass||'',desc:a.desc||'',content:''}));
if (!news.length || !cols.length) throw new Error('article arrays are empty');
const latestNews = news.reduce((latest, article) => article.id > latest.id ? article : latest, news[0]);
const latestColumn = cols.reduce((latest, article) => article.id > latest.id ? article : latest, cols[0]);
function assertUniqueIds(items, label) { const ids = items.map(a => a.id); const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i); if (duplicates.length) throw new Error(label + ' に重複IDがあります: ' + [...new Set(duplicates)].join(', ')); }
assertUniqueIds(news, 'ニュース');
assertUniqueIds(cols, 'コラム');

// 色の正本は本サイト index.html の定義そのものを読む。
const columnStyles = Function('"use strict"; return (' + getObject(source, 'const COLUMN_TAG_STYLES = Object.freeze(') + ')')();
const cssVars = Object.fromEntries([...source.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map(m => [m[1], m[2]]));
function resolveCssColor(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^var\(--([a-z0-9-]+)\)$/);
  return m ? (cssVars[m[1]] || raw) : raw;
}

// 記事データの分類色は本体側のTailwind色を尊重しつつ、分析画面では天命乃杜の共通パレットへ正規化する。
const dashboardColorMap = {
  '#1d4ed8': '#7188a4', '#2563eb': '#7188a4', '#3b82f6': '#7188a4',
  '#2c5282': '#7188a4', '#b91c1c': '#8f252b', '#dc2626': '#8f252b',
  '#ef4444': '#8f252b', '#a63b32': '#8f252b', '#8b2621': '#8f252b',
  '#0f766e': '#718b7b', '#047857': '#718b7b', '#16a34a': '#718b7b',
  '#15803d': '#718b7b', '#4a7c59': '#718b7b', '#95a5a6': '#786e67',
  '#b45309': '#9b793d', '#a16207': '#9b793d', '#d97706': '#c4a059',
  '#e67e22': '#c4a059', '#7e22ce': '#8b7898', '#9333ea': '#8b7898',
  '#be185d': '#8b7898', '#db2777': '#8b7898', '#4b3fa4': '#8b7898',
  '#2c3e50': '#55443a', '#4b5563': '#786e67', '#7f8c8d': '#786e67'
};
const approvedDashboardColors = new Set([
  '#302923', '#8f252b', '#c4a059', '#d5b16b', '#55443a', '#786e67',
  '#f7f2ed', '#e7ded7', '#718b7b', '#7188a4', '#8b7898', '#ead8c8',
  '#9b793d', '#5f1717', '#89631f', '#fffdfb'
]);
function normalizeDashboardColor(value) {
  const color = String(value || '').trim().toLowerCase();
  const normalized = dashboardColorMap[color] || color;
  return approvedDashboardColors.has(normalized) ? normalized : '#786e67';
}
// 同じカテゴリでも記事ごとに色クラスが変わる場合がある。
// 記事データ側の colorClass はそのまま保持し、カテゴリ集計図では最新記事の色を代表色にする。
const catColors = {};
for (const a of [...cols].sort((left, right) => right.id - left.id)) {
  if (!a.category) continue;
  const style = columnStyles[a.colorClass];
  if (!style || !style.text) throw new Error('unknown site column style: ' + a.colorClass);
  const color = normalizeDashboardColor(resolveCssColor(style.text));
  if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) throw new Error('unresolved site column color: ' + a.colorClass + ' -> ' + color);
  if (!catColors[a.category]) catColors[a.category] = color;
}
const newsColorMap = Function('"use strict"; return (' + getObject(source, 'const NEWS_TAG_COLOR_CLASS_MAP = Object.freeze(') + ')')();
const newsClassColors = {};
for (const [tagColor, colorClass] of Object.entries(newsColorMap)) {
  const match = source.match(new RegExp('\\.' + colorClass + '\\s*\\{[^}]*?color\\s*:\\s*(#[0-9a-fA-F]{3,8})', 'm'));
  if (match) newsClassColors[tagColor] = match[1];
}
// タグの色が履歴の途中で変更された場合も、最新記事の色を集計図の代表色として使う。
const tagColors = {};
for (const a of [...news].sort((left, right) => right.id - left.id)) {
  if (!a.tag) continue;
  const colorClass = newsColorMap[a.tagColor];
  const color = normalizeDashboardColor(newsClassColors[a.tagColor]);
  if (!colorClass || !color) throw new Error('unknown site news tag color: ' + a.tag + ' / ' + a.tagColor);
  if (!tagColors[a.tag]) tagColors[a.tag] = color;
}
// 本文文字数は毎回、本体の countArticleCharacters() と同じ基準で全件再計算し、過去の固定値を再利用しない。
function contentHash(html) { return crypto.createHash('sha256').update(String(html || ''), 'utf8').digest('hex'); }
const newsContentHashes = Object.fromEntries(newsSource.map(a => [String(a.id), contentHash(a.content)]));
const colContentHashes = Object.fromEntries(colSource.map(a => [String(a.id), contentHash(a.content)]));
const newsChars = Object.fromEntries(newsSource.map(a => [String(a.id), visibleChars(a.content)]));
const colChars = Object.fromEntries(colSource.map(a => [String(a.id), visibleChars(a.content)]));

// 「洞察・考察」は記事データとは別の分析資産。現行49件の文章を一文字も失わない。
// 自動同期で index.html の配列を書き換えても、既存49件の文章を一文字も失わない。
// 元サイトにこの分析文章の正本が存在しないため、現在のダッシュボード文を保護対象として扱う。
function extractInsights(text) {
  const re = /<div class="chart-desc"><div class="chart-desc-title">▍ 洞察・考察<\/div><div class="chart-desc-copy">([\s\S]*?)<\/div><\/div>/g;
  return [...text.matchAll(re)].map(m => m[1]);
}
const insightsBefore = extractInsights(dashboard);
if (!insightsBefore.length) throw new Error('洞察・考察が見つかりません');
if (insightsBefore.length !== 49) throw new Error(`洞察・考察の件数が想定外です（現行49件の洞察・考察を維持する想定）: ${insightsBefore.length}`);
const insightCharsBefore = insightsBefore.reduce((sum, text) => sum + visibleChars(text), 0);

// Comprehensive Analysis も分析資産として完全保護する。
function extractComprehensive(text) {
  const start = text.indexOf('  <!-- MEGA SUMMARY -->');
  if (start < 0) throw new Error('Comprehensive Analysis が見つかりません');
  const end = text.indexOf('<script', start);
  if (end < 0) throw new Error('Comprehensive Analysis の終端が見つかりません');
  return text.slice(start, end);
}
const comprehensiveBefore = extractComprehensive(dashboard);
const comprehensiveCharsBefore = visibleChars(comprehensiveBefore);
if (comprehensiveCharsBefore < 3000) throw new Error('Comprehensive Analysis の本文が想定より短すぎます: ' + comprehensiveCharsBefore);

function replaceArray(text, declaration, value) {
  const start = text.indexOf(declaration);
  if (start < 0) throw new Error('dashboard declaration not found: ' + declaration);
  const open = text.indexOf('[', start);
  let depth=0, quote=null, escaped=false, template=false;
  for (let i=open;i<text.length;i++) {
    const ch=text[i];
    if (quote) { if (escaped){escaped=false;continue;} if(ch==='\\'){escaped=true;continue;} if(ch===quote)quote=null; continue; }
    if(ch===BT){template=!template;continue;}
    if(template){if(ch==='\\')i++;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='[')depth++; else if(ch===']'){depth--;if(!depth)return text.slice(0,open)+value+text.slice(i+1);}
  }
  throw new Error('unterminated dashboard array');
}

function replaceObject(text, declaration, value) {
  const start=text.indexOf(declaration);
  if(start<0)throw new Error('dashboard declaration not found: '+declaration);
  const open=text.indexOf('{',start);
  let depth=0,quote=null,escaped=false;
  for(let i=open;i<text.length;i++){
    const ch=text[i];
    if(quote){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'){depth--;if(!depth)return text.slice(0,open)+value+text.slice(i+1);}
  }
  throw new Error('unterminated dashboard object');
}

dashboard=replaceArray(dashboard,'const newsData = [',JSON.stringify(news,null,2));
dashboard=replaceArray(dashboard,'const colData = [',JSON.stringify(cols,null,2));
dashboard=replaceObject(dashboard,'const newsChars = {',JSON.stringify(newsChars));
dashboard=replaceObject(dashboard,'const colChars = {',JSON.stringify(colChars));
if (!dashboard.includes('const newsContentHashes = {')) dashboard=dashboard.replace('const newsChars = {','const newsContentHashes = '+JSON.stringify(newsContentHashes)+';\nconst newsChars = {'); else dashboard=replaceObject(dashboard,'const newsContentHashes = {',JSON.stringify(newsContentHashes));
if (!dashboard.includes('const colContentHashes = {')) dashboard=dashboard.replace('const colChars = {','const colContentHashes = '+JSON.stringify(colContentHashes)+';\nconst colChars = {'); else dashboard=replaceObject(dashboard,'const colContentHashes = {',JSON.stringify(colContentHashes));
dashboard=replaceObject(dashboard,'const catColors = {',JSON.stringify(catColors,null,2));
dashboard=replaceObject(dashboard,'const tagColors = {',JSON.stringify(tagColors,null,2));

function parseDashboardArray(text, declaration) { return evalArray(getArray(text, declaration)); }
function assertArticleSync(sourceItems, dashboardItems, label, fields) {
  if (sourceItems.length !== dashboardItems.length) throw new Error(label + '件数が一致しません: source=' + sourceItems.length + ', dashboard=' + dashboardItems.length);
  const dashboardById = new Map(dashboardItems.map(a => [a.id, a]));
  for (const sourceArticle of sourceItems) {
    const d = dashboardById.get(sourceArticle.id);
    if (!d) throw new Error(label + ' ID ' + sourceArticle.id + ' がダッシュボードにありません');
    for (const field of fields) if (String(sourceArticle[field] ?? '') !== String(d[field] ?? '')) throw new Error(label + ' ID ' + sourceArticle.id + ' の ' + field + ' が一致しません');
  }
}
const syncedNews=parseDashboardArray(dashboard,'const newsData = [');
const syncedCols=parseDashboardArray(dashboard,'const colData = [');
assertArticleSync(newsSource,syncedNews,'ニュース',['id','title','date','time','tag','tagColor','borderColor','desc']);
assertArticleSync(colSource,syncedCols,'コラム',['id','title','date','category','icon','colorClass','desc']);
if (Math.max(...syncedNews.map(a=>a.id)) !== latestNews.id) throw new Error('最新ニュースIDが同期後に一致しません');
if (Math.max(...syncedCols.map(a=>a.id)) !== latestColumn.id) throw new Error('最新コラムIDが同期後に一致しません');

// 最終防衛線: 同期前後で洞察・考察の件数・本文を完全一致させる。
// 文字数の減少も許可しない。1文字でも失われたら workflow 自体を失敗させる。
const insightsAfter = extractInsights(dashboard);
if (insightsAfter.length !== insightsBefore.length) {
  throw new Error(`洞察・考察の件数が同期前後で変化しました: ${insightsBefore.length} -> ${insightsAfter.length}`);
}
for (let i = 0; i < insightsBefore.length; i++) {
  if (insightsAfter[i] !== insightsBefore[i]) {
    throw new Error(`洞察・考察 #${i + 1} の本文が同期中に変更・欠落しました`);
  }
}
const insightCharsAfter = insightsAfter.reduce((sum, text) => sum + visibleChars(text), 0);
if (insightCharsAfter < insightCharsBefore) {
  throw new Error(`洞察・考察の文字数が減少しました: ${insightCharsBefore} -> ${insightCharsAfter}`);
}
if (insightCharsAfter !== insightCharsBefore) {
  throw new Error(`洞察・考察の文字数が変化しました: ${insightCharsBefore} -> ${insightCharsAfter}`);
}



const comprehensiveAfter = extractComprehensive(dashboard);
const comprehensiveCharsAfter = visibleChars(comprehensiveAfter);
if (comprehensiveAfter !== comprehensiveBefore) {
  throw new Error('Comprehensive Analysis の本文が同期中に変更・欠落しました');
}
if (comprehensiveCharsAfter !== comprehensiveCharsBefore) {
  throw new Error(`Comprehensive Analysis の文字数が変化しました: ${comprehensiveCharsBefore} -> ${comprehensiveCharsAfter}`);
}

function setSourceSnapshotMeta(text, name, value) {
  if (!value) return text;
  if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error('invalid source snapshot SHA for ' + name);
  const tag = '<meta name="' + name + '" content="' + value + '">';
  const pattern = new RegExp("<meta\\s+name=[\"']" + name + "[\"'][^>]*>", 'i');
  if (pattern.test(text)) return text.replace(pattern, tag);
  const headEnd = text.indexOf('</head>');
  if (headEnd < 0) throw new Error('dashboard <head> not found while writing source snapshot');
  return text.slice(0, headEnd) + '  ' + tag + '\n' + text.slice(headEnd);
}
const sourceSnapshotFields = [
  ['tenmei-source-commit', process.env.TENMEI_SOURCE_COMMIT],
  ['tenmei-source-index-blob', process.env.TENMEI_SOURCE_INDEX_BLOB],
  ['tenmei-source-health-history-blob', process.env.TENMEI_SOURCE_HEALTH_HISTORY_BLOB],
  ['tenmei-source-health-current-blob', process.env.TENMEI_SOURCE_HEALTH_CURRENT_BLOB]
];
const providedSnapshotFields = sourceSnapshotFields.filter(([, value]) => value);
if (providedSnapshotFields.length && providedSnapshotFields.length !== sourceSnapshotFields.length) throw new Error('source snapshot environment is incomplete');
for (const [name, value] of sourceSnapshotFields) dashboard = setSourceSnapshotMeta(dashboard, name, value);

fs.writeFileSync(DASHBOARD_FILE,dashboard);
console.log(JSON.stringify({news:news.length,columns:cols.length,total:news.length+cols.length,latestNews,latestColumn},null,2));