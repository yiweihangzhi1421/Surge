let rawBody = $response.body;
let body;

try {
  body = typeof rawBody === "string"
    ? rawBody
    : new TextDecoder("utf-8").decode(rawBody);
} catch (e) {
  console.log("解码失败");
  $done({});
  return;
}

// 匹配 Netflix 字幕格式
if (!body || !body.match(/\d+:\d\d:\d\d\.\d{3} -->.+line.+\n.+/g)) {
  $done({});
  return;
}

// 固定设置
const sl = "auto";       // 源语言
const tl = "zh-CN";      // 目标语言（简体中文）
const line = "s";        // 英文在上，中文在下

translate();

async function translate() {
  body = body.replace(/\r/g, "").replace(/(\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n.+)\n(.+)/g, "$1 $2");

  const dialogue = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n.+/g);
  const timeline = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+/g);

  if (!dialogue || !timeline) {
    $done({});
    return;
  }

  let sents = [];
  for (let i in dialogue) {
    const text = dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n/, "");
    sents.push(`~${i}~${text}`);
  }

  const grouped = group(sents, 80);
  let result = [];

  for (let group of grouped) {
    const res = await googleTranslate(group.join("\n"));
    if (res.sentences) {
      for (let s of res.sentences) {
        if (s.trans) {
          result.push(s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
        }
      }
    }
  }

  const translations = result.join(" ").match(/~\d+~[^~]+/g);
  if (!translations) {
    $done({});
    return;
  }

  for (let j in dialogue) {
    const patt = new RegExp(`(${timeline[j]}(\\n.+)+)`);
    const match = new RegExp(`~${j}~\\s*(.+)`);
    const lineTrans = translations.find(x => x.match(match));
    if (lineTrans) {
      body = body.replace(patt, `$1\n${lineTrans.match(match)[1]}`);
    }
  }

  $done({ body });
}

function googleTranslate(query) {
  return $task.fetch({
    url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${sl}&tl=${tl}`,
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0" },
    body: `q=${encodeURIComponent(query)}`
  }).then(res => {
    try {
      return JSON.parse(res.body);
    } catch (e) {
      return {};
    }
  });
}

function group(arr, size) {
  let result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
