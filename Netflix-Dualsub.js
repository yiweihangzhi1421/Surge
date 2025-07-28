let url = $request.url;
let rawBody = $response.body;
let body;

try {
  if (typeof rawBody === "string") {
    body = rawBody;
  } else if (typeof TextDecoder !== "undefined") {
    body = new TextDecoder("utf-8").decode(rawBody);
  } else {
    console.log("TextDecoder 不可用，跳过");
    $done({});
  }
} catch (e) {
  console.log("解码失败，跳过");
  $done({});
  return;
}

// Netflix VTT 字幕格式检查
if (!body || !body.match(/\d+:\d\d:\d\d\.\d{3} -->.+line.+\n.+/g)) $done({});

// 固定配置
let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "s" // 英文在上，中文在下
};

translate();

async function translate() {
  body = body.replace(/\r/g, "");
  body = body.replace(/(\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n.+)\n(.+)/g, "$1 $2");

  let dialogue = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n.+/g);
  if (!dialogue) $done({});

  let timeline = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+/g);
  let s_sentences = [];

  for (let i in dialogue) {
    let clean = dialogue[i]
      .replace(/<\/*(c\.[^>]+|i|c)>/g, "")
      .replace(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n/, "");
    s_sentences.push("~" + i + "~" + clean);
  }

  s_sentences = group(s_sentences, 80);

  let trans_result = [];
  for (let group of s_sentences) {
    let query = group.join("\n");
    let res = await translateGoogle(query);
    if (res.sentences) {
      for (let s of res.sentences) {
        if (s.trans) {
          trans_result.push(
            s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~")
          );
        }
      }
    }
  }

  let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  if (!t_sentences || !t_sentences.length) $done({});

  let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");

  for (let j in dialogue) {
    let patt = new RegExp(`(${timeline[j]}(\\n.+)+)`);
    let patt2 = new RegExp(`~${j}~\\s*(.+)`);
    if (g_t_sentences.match(patt2)) {
      body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
    }
  }

  $done({ body });
}

function translateGoogle(query) {
  let options = {
    url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}`,
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0" },
    body: `q=${encodeURIComponent(query)}`
  };

  return new Promise((resolve) => {
    $task.fetch(options).then((resp) => {
      try {
        resolve(JSON.parse(resp.body));
      } catch (e) {
        resolve({});
      }
    });
  });
}

function group(arr, size) {
  let result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
