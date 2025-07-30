let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "f" // "f" 表示英文在上，中文在下
};

let body = $response.body;
if (!body) {
  console.log("🔴 无字幕内容，$response.body 为空");
  $done({});
}

body = body.replace(/\r/g, "");
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
if (!dialogue) {
  console.log("🔴 无匹配字幕行，可能字幕格式异常");
  $done({});
}

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
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `q=${encodeURIComponent(chunk.join("\n"))}`
    };

    try {
      let res = await request(options);
      console.log("🟢 Google 翻译状态码:", res?.status || "未知");
      if (res.sentences) {
        for (let s of res.sentences) {
          if (s.trans) {
            trans_result.push(
              s.trans
                .replace(/\n$/g, "")
                .replace(/\n/g, " ")
                .replace(/〜|～/g, "~")
            );
          }
        }
      }
    } catch (err) {
      console.log("🔴 Google 翻译失败:", err);
      return $done({ body });
    }
  }

  if (trans_result.length === 0) {
    console.log("🟡 翻译结果为空，返回原始字幕");
    return $done({ body });
  }

  let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  if (!t_sentences) {
    console.log("🟡 翻译匹配失败（~编号~ 没有命中）");
    return $done({ body });
  }

  for (let j in dialogue) {
    let index = parseInt(j);
    let trans = t_sentences.find(t => t.startsWith(`~${index}~`));
    if (!trans) continue;
    let line = trans.replace(/^~\d+~/, "").trim();
    let patt = new RegExp(`(${timeline[j]})`);
    if (setting.line === "s") {
      patt = new RegExp(
        `(${dialogue[j].replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1")})`
      );
    }
    body = body.replace(patt, `$1\n${line}`);
  }

  console.log("✅ 注入翻译完成，输出字幕");
  $done({ body });
})();

function request(opt) {
  return new Promise((resolve, reject) => {
    $httpClient.post(opt, (err, resp, data) => {
      if (err) return reject(err);
      try {
        let parsed = JSON.parse(data);
        parsed.status = resp?.status;
        resolve(parsed);
      } catch (e) {
        console.log("🔴 JSON 解析失败:", data);
        reject("JSON parse error");
      }
    });
  });
}
