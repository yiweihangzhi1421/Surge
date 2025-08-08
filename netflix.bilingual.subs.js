/**
 * Netflix Bilingual Subtitles for Surge
 * - Handles VTT, TTML/DFXP
 * - Google translate by default (no key)
 * Arguments (via Surge "argument="):
 *   Vendor=Google|Microsoft|DeepL   (仅实现了 Google；其余占位)
 *   Languages=AUTO,ZH|ZH-HANT|YUE
 *   Position=Forward|Reverse
 *   ShowOnly=true|false
 *   Times=3            (重试次数)
 *   Interval=500       (重试间隔 ms)
 */

const begin = Date.now();

function log(...args){ console.log('[NFLX]', ...args); }
function argToObj(a){
  if(!a) return {};
  if(typeof a === 'object') return a;
  let obj = {};
  a.split('&').forEach(kv=>{
    const i=kv.indexOf('=');
    if(i<0) obj[kv]=true; else obj[decodeURIComponent(kv.slice(0,i))]=decodeURIComponent(kv.slice(i+1));
  });
  return obj;
}

const args = Object.assign({
  Vendor: 'Google',
  Languages: 'AUTO,ZH',
  Position: 'Forward',
  ShowOnly: 'false',
  Times: '3',
  Interval: '500',
}, argToObj($argument));

const SHOW_ONLY = String(args.ShowOnly).toLowerCase() === 'true';
const POSITION  = (args.Position||'Forward');
const [SRC, TGT] = (args.Languages||'AUTO,ZH').split(',').map(s=>s.trim());
const RETRIES = Math.max(0, parseInt(args.Times||'3',10));
const INTERVAL = Math.max(100, parseInt(args.Interval||'500',10));

const ct = ($response.headers['Content-Type'] || $response.headers['content-type'] || '').split(';')[0] || '';
let bodyBytes = $response.bodyBytes;
let body = $response.body;
if (bodyBytes && !body) try { body = new TextDecoder().decode(bodyBytes); } catch {}

log('Content-Type =', ct);

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function withRetry(fn, times=RETRIES, gap=INTERVAL){
  let err;
  for(let i=0;i<=times;i++){
    try { return await fn(); } catch(e){ err=e; if(i<times) await sleep(gap * (i?2:1)); }
  }
  throw err;
}

/* ----------------- Google 翻译（免 key） ----------------- */
async function translateGoogle(chunks, sl, tl){
  // 将每个 chunk（数组）拼成一条请求，防止 URL 过长
  const UA = 'Mozilla/5.0';
  const results = [];
  for(const arr of chunks){
    if(arr.length === 0){ results.push([]); continue; }
    const joined = arr.join('\r'); // 用 \r 保持切分
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(sl||'auto')}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(joined)}`;
    const res = await withRetry(()=>httpGet(url, { 'User-Agent': UA, 'Accept': '*/*' }));
    let data;
    try{ data = JSON.parse(res.body); }catch{ data = null; }
    let lines = [];
    if (Array.isArray(data) && Array.isArray(data[0])) {
      // 合并所有句段
      const text = data[0].map(x=>x && x[0] || '').join('');
      lines = text.split('\r');
    } else if (data && data.sentences) {
      const text = data.sentences.map(s=>s.trans||'').join('');
      lines = text.split('\r');
    } else {
      // 失败兜底：返回原文
      lines = joined.split('\r');
    }
    results.push(lines);
  }
  return results.flat();
}

function httpGet(url, headers={}){
  return new Promise((resolve, reject)=>{
    $httpClient.get({url, headers, timeout: 10}, (err, resp, data)=>{
      if(err) return reject(err);
      resolve({ status: resp.status, headers: resp.headers, body: data });
    });
  });
}

/* ----------------- 文本切分与合成 ----------------- */
function chunkBySize(arr, maxChars){
  const out = [];
  let buf = [], size = 0;
  for(const s of arr){
    const add = (s || '').length + 1;
    if(size + add > maxChars && buf.length){
      out.push(buf); buf = [s]; size = add;
    } else { buf.push(s); size += add; }
  }
  if(buf.length) out.push(buf);
  return out;
}

function combine(origin, trans){
  if (SHOW_ONLY) return trans || origin || '';
  if (POSITION === 'Reverse') return (trans||'') + '\n' + (origin||'');
  return (origin||'') + '\n' + (trans||'');
}

function xmlEscape(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

/* ----------------- 解析与重写：VTT ----------------- */
function isVTTText(txt){
  const head = (txt||'').slice(0,8).toUpperCase();
  return head.includes('WEBVTT');
}
function rewriteVTT(vtt, translated){
  const blocks = vtt.split(/\r?\n\r?\n/);
  let ti = 0;
  const out = blocks.map(b=>{
    const lines = b.split(/\r?\n/);
    if(!lines.length) return b;
    // 寻找时间轴行
    let timingIdx = -1;
    for(let i=0;i<lines.length;i++){
      if(/-->/i.test(lines[i])){ timingIdx = i; break; }
    }
    if(timingIdx === -1) return b;
    const header = lines.slice(0, timingIdx+1);
    const textLines = lines.slice(timingIdx+1);
    const origin = textLines.join('\n').trim();
    const trans = translated[ti++] || '';
    const mixed = combine(origin, trans);
    return [...header, mixed].join('\n');
  });
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n');
}

/* ----------------- 解析与重写：TTML/DFXP ----------------- */
function isXMLLike(txt){
  const head = (txt||'').trim().slice(0,6);
  return head === '<?xml' || head.startsWith('<tt') || head.startsWith('<timedtext') || head.startsWith('<div') || head.startsWith('<p');
}
function extractPBlocks(xml){
  // 捕获每个 <p ...>...</p>
  const re = /<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi;
  const blocks = [];
  let m;
  while((m = re.exec(xml)) !== null){
    blocks.push({ full: m[0], inner: m[1], index: m.index, len: m[0].length });
  }
  return blocks;
}
function innerToPlain(inner){
  // 去掉 span 标签、把 <br/> 变成换行，再剥离所有其他标签
  return inner
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}
function rewriteXML(xml, translated){
  const blocks = extractPBlocks(xml);
  let ti = 0;
  let out = '';
  let lastPos = 0;
  for(const b of blocks){
    out += xml.slice(lastPos, b.index); // 追加块前面的原始内容
    const originPlain = innerToPlain(b.inner);
    const trans = translated[ti++] || '';
    if (SHOW_ONLY) {
      out += `<p>${xmlEscape(trans)}</p>`;
    } else if (POSITION === 'Reverse') {
      out += b.full.replace(b.inner, `${xmlEscape(trans)}&#x000A;${b.inner}`);
    } else {
      out += b.full.replace(b.inner, `${b.inner}&#x000A;${xmlEscape(trans)}`);
    }
    lastPos = b.index + b.len;
  }
  out += xml.slice(lastPos);
  return out;
}

/* ----------------- 主流程 ----------------- */
(async () => {
  try{
    if(!body){ $done({}); return; }

    // 收集需要翻译的文本单元
    let units = [];
    let mode = ''; // 'vtt' | 'xml'
    if (ct.includes('vtt') || isVTTText(body)) {
      mode = 'vtt';
      const blocks = body.split(/\r?\n\r?\n/);
      for(const b of blocks){
        const lines = b.split(/\r?\n/);
        const idx = lines.findIndex(l=>/-->/i.test(l));
        if(idx >= 0){
          const text = lines.slice(idx+1).join('\n').trim();
          units.push(text || '​');
        }
      }
    } else if (/xml|ttml|dfxp|html/i.test(ct) || isXMLLike(body)) {
      mode = 'xml';
      const blocks = extractPBlocks(body);
      for(const b of blocks){
        units.push(innerToPlain(b.inner) || '​');
      }
    } else {
      // 其他类型不处理
      $done({});
      return;
    }

    // 按长度分片（控制 URL 约 3000 字符以内）
    const chunks = chunkBySize(units, 3000);

    let translated = [];
    if((args.Vendor||'Google').toLowerCase() === 'google'){
      translated = await translateGoogle(chunks, (SRC||'auto'), (TGT||'zh'));
    } else {
      // 其他厂商可在此扩展
      translated = units.slice(); // 占位：不翻译
    }

    let newBody = body;
    if (mode === 'vtt') {
      newBody = rewriteVTT(body, translated);
    } else {
      newBody = rewriteXML(body, translated);
    }

    // 输出（按 Surge 需要带回 body/bodyBytes）
    $done({ body: newBody });

  } catch (e){
    log('ERROR:', e && (e.stack || e));
    $done({});
  } finally {
    log('done in', (Date.now()-begin)+'ms');
  }
})();
