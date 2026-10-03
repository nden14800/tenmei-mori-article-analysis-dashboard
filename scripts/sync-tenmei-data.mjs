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

const colorMap = {
  yellow:'#eab308', indigo:'#6366f1', blue:'#3b82f6', purple:'#a855f7',
  orange:'#f97316', red:'#ef4444', green:'#22c55e', pink:'#ec4899', gray:'#6b7280'
};
const catColors = {};
for (const a of cols) {
  if (!a.category) continue;
  if (!colorMap[a.colorClass]) throw new Error('unknown site colorClass: ' + a.colorClass);
  catColors[a.category] = colorMap[a.colorClass];
}

// 既存記事の文字数は、過去に本サイトの countArticleCharacters() と照合して確定した値を維持する。
// 正規表現だけで再計算するとブラウザの DOM textContent と微妙にずれるため、既存値を再計算して上書きしない。
// 新規記事だけは現在の同期処理で算出し、次回以降はその確定値として保持する。
const historicalCharCounts = {"1":850,"2":608,"3":482,"4":408,"5":376,"6":787,"7":912,"8":628,"9":650,"10":703,"11":593,"12":569,"13":1352,"14":488,"15":480,"16":737,"17":622,"18":550,"19":541,"20":626,"21":777,"22":611,"23":731,"24":736,"25":533,"26":521,"27":1971,"28":583,"29":542,"30":565,"31":713,"32":508,"33":786,"34":738,"35":972,"36":748,"37":843,"38":642,"39":691,"40":588,"41":807,"42":787,"43":923,"44":786,"45":585,"46":893,"47":1205,"48":1268,"49":1124,"50":1226,"51":1290,"52":1407,"53":1477,"54":1102,"55":1235,"56":1311,"57":1315,"58":1016,"59":1149,"60":888,"61":1280,"62":787,"63":820,"64":725,"65":764,"66":666,"67":691,"68":813,"69":449,"70":699,"71":730,"72":958,"73":1337,"74":1649,"75":2176,"76":1173,"77":1357,"78":2479,"79":1828,"80":4906,"81":2451,"82":3885,"83":2670,"84":2023,"85":1740,"86":1962};
const newsChars = Object.fromEntries(newsSource.map(a => {
  const key = String(a.id);
  return [key, Object.prototype.hasOwnProperty.call(historicalCharCounts, key)
    ? historicalCharCounts[key]
    : visibleChars(a.content)];
}));
const colChars = Object.fromEntries(colSource.map(a => {
  const key = String(a.id);
  return [key, Object.prototype.hasOwnProperty.call(historicalCharCounts, key)
    ? historicalCharCounts[key]
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