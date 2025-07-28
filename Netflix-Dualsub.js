let url = $request.url;
let raw = $response.body;
let body;

// ✅ 自动兼容 Loon 中 base64 编码或纯文本情况
try {
  if (typeof raw === "string") {
    // 判断是否为 base64 编码格式（含大量 A-Z0-9+/）
    if (/^[A-Za-z0-9+/=\s]+$/.test(raw.slice(0, 200))) {
      body = atob(raw);
    } else {
      body = raw; // 直接处理纯文本
    }
  } else {
    body = raw;
  }
} catch (e) {
  console.log("[解码失败] 跳过该请求", e);
  $done({});
}

let setting = {
  sl: "auto",
  tl: "zh-CN",
  line: "f" // f = 中文在上，英文在下；s = 英文在上，中文在下
};

if (!body || !body.match(/\d+:\d\d:\d\d\.\d+ -->.+\n.+/g)) $done({});
if (url.includes(".m3u8")) $done({});

(async () => {
  body = body.replace(/\r/g, "");
  body = body.replace(/(\d+:\d\d:\d\d\.\d+ --> \d+:\d\d:\d\d\.\d+\n.+)\n(.+)/g, "$1 $2");

  let dialogue = body.match(/\d+:\d\d:\d\d\.\d+ --> \d+:\d\d:\d\d\.\d+\n.+/g);
  if (!dialogue) return $done({});

  let timeline = body.match(/\d+:\d\d:\d\d\.\d+ --> \d+:\d\d:\d\d\.\d+/g);
  let s_sentences = [];

  for (let i in dialogue) {
    let clean = dialogue[i]
      .replace(/<[^>]+>/g, "")
      .replace(/\d+:\d\d:\d\d\.\d+ --> \d+:\d\d:\d\d\.\d+\n/, "");
    s_sentences.push("~" + i + "~" + clean);
  }

  s_sentences = groupAgain(s_sentences, 80);
  let trans_result = [];

  for (let group of s_sentences) {
    let options = {
      url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}`,
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0" },
      body: `q=${encodeURIComponent(group.join("\n"))}`
    };

    let res = await $task.fetch(options);
    let data = JSON.parse(res.body);
    for (let s of data.sentences) {
      if (s.trans) {
        trans_result.push(s.trans.replace(/〜|～/g, "~"));
      }
    }
  }

  let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  if (!t_sentences) return $done({ body });

  let g_t_sentences = t_sentences.join("\n");

  for (let j in dialogue) {
    let patt = new RegExp(`(${timeline[j]})`);
    let patt2 = new RegExp(`~${j}~\\s*(.+)`);
    let match = g_t_sentences.match(patt2);
    if (match) {
      // 中文在上，英文在下
      body = body.replace(patt, `${match[1]}\n$1`);
    }
  }

  $done({ body });

})();

function groupAgain(data, num) {
  let result = [];
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num));
  }
  return result;
}
