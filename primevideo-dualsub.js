// Prime Video Dualsub for Surge
// Fixed configuration: Google Translate, Chinese on top, English below

let url = $request.url;
let headers = $request.headers;

let setting = {
  type: "Google",
  lang: "English [CC]",
  sl: "auto",
  tl: "zh-CN",
  line: "f",
  dkey: "null",
  s_subtitles_url: "null",
  t_subtitles_url: "null",
  subtitles: "null",
  subtitles_type: "null",
  subtitles_sl: "null",
  subtitles_tl: "null",
  subtitles_line: "null",
  external_subtitles: "null"
};

if (!url.match(/\.vtt/)) $done({});

let body = $response.body;
if (!body) $done({});

body = body.replace(/\r/g, "");
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
if (!dialogue) $done({});

let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);

let s_sentences = dialogue.map((d, i) => `~${i}~${d.replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`);
s_sentences = groupAgain(s_sentences, 80);

(async () => {
  let t_sentences = [];
  for (let p in s_sentences) {
    let options = {
      url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&dj=1&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
    };

    let trans = await send_request(options, "post");
    if (trans.sentences) {
      trans.sentences.forEach(s => {
        if (s.trans) t_sentences.push(s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
      });
    }
  }

  if (t_sentences.length > 0) {
    let g_t_sentences = t_sentences.join(" ").match(/~\d+~[^~]+/g);
    for (let j in dialogue) {
      let patt = new RegExp(`(${timeline[j]})`);
      let patt2 = new RegExp(`~${j}~\\s*(.+)`);
      if (g_t_sentences && g_t_sentences[j]) {
        let translated = g_t_sentences[j].replace(new RegExp(`~${j}~`), "");
        body = body.replace(patt, `$1\n${translated}\n${dialogue[j].replace(/${timeline[j]}\n/, "")}`);
      }
    }
  }
  $done({ body });
})();

function send_request(options, method) {
  return new Promise((resolve, reject) => {
    if (method === "get") {
      $httpClient.get(options, (e, r, d) => {
        if (e) reject(e);
        else resolve(d);
      });
    } else {
      $httpClient.post(options, (e, r, d) => {
        if (e) reject(e);
        else resolve(JSON.parse(d));
      });
    }
  });
}

function groupAgain(data, num) {
  let result = [];
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num));
  }
  return result;
}
