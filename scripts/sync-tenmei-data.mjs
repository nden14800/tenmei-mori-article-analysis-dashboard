import fs from 'node:fs';

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

function visibleChars(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, '')
    .length;
}

const newsSource = evalArray(getArray(source, 'const newsData = ['));
const colSource = evalArray(getArray(source, 'const columnData = ['));
const news = newsSource.map(a => ({id:a.id,title:a.title,date:a.date,time:a.time||'',tag:a.tag||'',tagColor:a.tagColor||'',borderColor:a.borderColor||'',desc:a.desc||'',content:''}));
const cols = colSource.map(a => ({id:a.id,title:a.title,date:a.date,category:a.category||'',icon:a.icon||'',colorClass:a.colorClass||'',desc:a.desc||'',content:''}));
if (!news.length || !cols.length) throw new Error('article arrays are empty');
if (!news.some(a => a.id === 89)) throw new Error('latest news #89 missing');
if (!cols.some(a => a.id === 65)) throw new Error('latest column #65 missing');

// 色の正本は本サイト index.html の定義そのものを読む。
const columnStyles = Function('"use strict"; return (' + getObject(source, 'const COLUMN_TAG_STYLES = Object.freeze(') + ')')();
const cssVars = Object.fromEntries([...source.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map(m => [m[1], m[2]]));
function resolveCssColor(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^var\(--([a-z0-9-]+)\)$/);
  return m ? (cssVars[m[1]] || raw) : raw;
}
const catColors = {};
for (const a of cols) {
  if (!a.category) continue;
  const style = columnStyles[a.colorClass];
  if (!style || !style.text) throw new Error('unknown site column style: ' + a.colorClass);
  const color = resolveCssColor(style.text);
  if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) throw new Error('unresolved site column color: ' + a.colorClass + ' -> ' + color);
  if (catColors[a.category] && catColors[a.category] !== color) throw new Error('site category uses multiple colors: ' + a.category);
  catColors[a.category] = color;
}
const newsColorMap = Function('"use strict"; return (' + getObject(source, 'const NEWS_TAG_COLOR_CLASS_MAP = Object.freeze(') + ')')();
const newsClassColors = {};
for (const [tagColor, colorClass] of Object.entries(newsColorMap)) {
  const match = source.match(new RegExp('\\.' + colorClass + '\\s*\\{[^}]*?color\\s*:\\s*(#[0-9a-fA-F]{3,8})', 'm'));
  if (match) newsClassColors[tagColor] = match[1];
}
const tagColors = {};
for (const a of news) {
  if (!a.tag) continue;
  const colorClass = newsColorMap[a.tagColor];
  const color = newsClassColors[a.tagColor];
  if (!colorClass || !color) throw new Error('unknown site news tag color: ' + a.tag + ' / ' + a.tagColor);
  if (tagColors[a.tag] && tagColors[a.tag] !== color) throw new Error('site tag uses multiple colors: ' + a.tag);
  tagColors[a.tag] = color;
}
// 既存記事の文字数は、過去に本サイトの countArticleCharacters() と照合して確定した値を維持する。
// 正規表現だけで再計算するとブラウザの DOM textContent と微妙にずれるため、既存値を再計算して上書きしない。
// 新規記事だけは現在の同期処理で算出し、次回以降はその確定値として保持する。
const historicalNewsChars = {"1":196,"2":277,"3":107,"4":98,"5":84,"6":295,"7":417,"8":386,"9":320,"10":290,"11":835,"12":394,"13":630,"14":1318,"15":1399,"16":352,"17":269,"18":548,"19":537,"20":453,"21":1265,"22":800,"23":702,"24":662,"25":950,"26":767,"27":1184,"28":602,"29":983,"30":863,"31":562,"32":441,"33":830,"34":680,"35":819,"36":550,"37":941,"38":1765,"39":475,"40":485,"41":826,"42":908,"43":432,"44":391,"45":359,"46":332,"47":514,"48":592,"49":398,"50":889,"51":431,"52":581,"53":625,"54":475,"55":353,"56":650,"57":649,"58":579,"59":774,"60":542,"61":636,"62":787,"63":820,"64":725,"65":764,"66":666,"67":691,"68":813,"69":449,"70":699,"71":730,"72":958,"73":1337,"74":1649,"75":2176,"76":1173,"77":1357,"78":2479,"79":1828,"80":4903,"81":2451,"82":3885,"83":2670,"84":2023,"85":1740,"86":1962,"87":4022};
const historicalColChars = {"1":849,"2":617,"3":484,"4":420,"5":382,"6":789,"7":910,"8":632,"9":651,"10":700,"11":595,"12":568,"13":1357,"14":494,"15":486,"16":734,"17":625,"18":556,"19":544,"20":626,"21":771,"22":615,"23":735,"24":732,"25":539,"26":519,"27":1967,"28":582,"29":543,"30":568,"31":716,"32":514,"33":789,"34":743,"35":973,"36":755,"37":846,"38":649,"39":691,"40":591,"41":811,"42":788,"43":921,"44":787,"45":585,"46":893,"47":1205,"48":1268,"49":1124,"50":1226,"51":1290,"52":1407,"53":1477,"54":1102,"55":1235,"56":1311,"57":1315,"58":1016,"59":1149,"60":888,"61":1280,"62":1241};
const newsChars = Object.fromEntries(newsSource.map(a => {
  const key = String(a.id);
  return [key, Object.prototype.hasOwnProperty.call(historicalNewsChars, key)
    ? historicalNewsChars[key]
    : visibleChars(a.content)];
}));
const colChars = Object.fromEntries(colSource.map(a => {
  const key = String(a.id);
  return [key, Object.prototype.hasOwnProperty.call(historicalColChars, key)
    ? historicalColChars[key]
    : visibleChars(a.content)];
}));

// 「洞察・考察」は記事データとは別の分析資産。
// 自動同期で index.html の配列を書き換えても、既存23件の文章を一文字も失わない。
// 元サイトにこの分析文章の正本が存在しないため、現在のダッシュボード文を保護対象として扱う。
function extractInsights(text) {
  const re = /<div class="chart-desc"><div class="chart-desc-title">▍ 洞察・考察<\/div>([\s\S]*?)<\/div>\s*<\/div>/g;
  return [...text.matchAll(re)].map(m => m[1]);
}
const insightsBefore = extractInsights(dashboard);
if (!insightsBefore.length) throw new Error('洞察・考察が見つかりません');
if (insightsBefore.length !== 23) throw new Error(`洞察・考察の件数が想定外です: ${insightsBefore.length}`);
const insightCharsBefore = insightsBefore.reduce((sum, text) => sum + visibleChars(text), 0);

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
dashboard=replaceObject(dashboard,'const catColors = {',JSON.stringify(catColors,null,2));
dashboard=replaceObject(dashboard,'const tagColors = {',JSON.stringify(tagColors,null,2));

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

fs.writeFileSync(DASHBOARD_FILE,dashboard);
console.log(JSON.stringify({news:news.length,columns:cols.length,total:news.length+cols.length,latestNews:news.reduce((a,b)=>a.id>b.id?a:b),latestColumn:cols.reduce((a,b)=>a.id>b.id?a:b)},null,2));