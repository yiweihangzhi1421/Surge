let headers = $request.headers;
let url = $request.url;

let body;
try {
  body = Buffer.from($response.body, "base64").toString("utf-8");
} catch (e) {
  console.log("[Error] Base64 解码失败，字幕无法处理");
  $done({});
}

let settings = {
  Netflix: {
    type: "Google",
    lang: "English",
    sl: "auto",
    tl: "zh-CN",
    line: "f", // 👈 中文在上方，英文在下方
    dkey: "null"
  }
};

let service = "Netflix";
let setting = settings[service];

if (!body || !body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+\n.+/g)) $done({});
if (setting.type === "Disable") $done({});
if (setting.type !== "Official" && url.match(/\.m3u8/)) $done({});

if (url.match(/\.(web)?vtt/) || service === "Netflix") {
  machine_subtitles("Google");
}

async function machine_subtitles(type) {
  body = body.replace(/\r/g, "");
  body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

  let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
  if (!dialogue) $done({});

  let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);
  let s_sentences = [];

  for (let i in dialogue) {
    let clean = dialogue[i]
      .replace(/<\/*(c\.[^>]+|i|c)>/g, "")
      .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "");
    s_sentences.push("~" + i + "~" + clean);
  }

  s_sentences = groupAgain(s_sentences, 80);

  let t_sentences = [];
  let trans_result = [];

  for (let p in s_sentences) {
    let options = {
      url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}`,
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0" },
      body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
    };

    let trans = await send_request(options);
    if (trans.sentences) {
      for (let s of trans.sentences) {
        if (s.trans) {
          trans_result.push(s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
        }
      }
    }
  }

  if (trans_result.length > 0) {
    t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  }

  if (t_sentences.length > 0) {
    let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");

    for (let j in dialogue) {
      let patt = new RegExp(`(${timeline[j]})`);
      if (setting.line === "s") {
        patt = new RegExp(dialogue[j].replace(/[[\]()?]/g, '\\$&'));
      }

      let patt2 = new RegExp(`~${j}~\\s*(.+)`);
      if (g_t_sentences.match(patt2)) {
        // 中文在上，英文在下
        body = body.replace(patt, `${g_t_sentences.match(patt2)[1]}\n$1`);
      }
    }
  }

  $done({ body: body });
}

function send_request(options) {
  return new Promise((resolve) => {
    $task.fetch(options).then(response => {
      resolve(options.method === "GET" ? response.body : JSON.parse(response.body));
    });
  });
}

function groupAgain(data, num) {
  let result = [];
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num));
  }
  return result;
}
