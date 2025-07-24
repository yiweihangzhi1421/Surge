let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "s" // 中文在上
};

let body = $response.body;

if (!body) $done({});

body = body.replace(/\r/g, "");
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
if (!dialogue) $done({});

let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);

let s_sentences = dialogue.map((d, i) =>
  `~${i}~${d.replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`
);

function group(data, num) {
  let result = [];
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num));
  }
  return result;
}

let grouped = group(s_sentences, 80);

(async () => {
  let trans_result = [];

  for (let chunk of grouped) {
    let options = {
      url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
      headers: {
        "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
      },
      body: `q=${encodeURIComponent(chunk.join("\n"))}`
    };

    let res = await request(options);
    if (res.sentences) {
      for (let s of res.sentences) {
        if (s.trans) trans_result.push(s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
      }
    }
  }

  if (trans_result.length === 0) return $done({ body });

  let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  if (!t_sentences) return $done({ body });

  for (let j in dialogue) {
    let index = parseInt(j);
    let trans = t_sentences.find(t => t.startsWith(`~${index}~`));
    if (!trans) continue;
    let line = trans.replace(/^~\d+~/, "").trim();
    let patt = new RegExp(`(${timeline[j]})`);
    if (setting.line === "s") patt = new RegExp(`(${dialogue[j].replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")})`);
    body = body.replace(patt, `$1\n${line}`);
  }

  $done({ body });
})();

function request(opt) {
  return new Promise((resolve, reject) => {
    $httpClient.post(opt, (err, resp, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch {
        reject("JSON parse error");
      }
    });
  });
}
