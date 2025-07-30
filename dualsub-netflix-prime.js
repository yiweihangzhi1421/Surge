// Prime Video Dualsub for Loon / Surge
// Google翻译 + 英文在上，中文在下 + 支持分段 VTT 字幕 + 日志输出

const setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "f" // 英文在上，中文在下
};

let body = $response.body;

if (!body) {
  console.log("[Dualsub] ❌ 字幕内容为空");
  return $done({});
}

// 字幕清洗预处理
body = body.replace(/\r/g, "");
body = body.replace(/(\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}\n.+)\n(.+)/g, "$1 $2");
body = body.replace(/(\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}\n.+)\n(.+)/g, "$1 $2");

const dialogue = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}\n.+/g);
if (!dialogue) {
  console.log("[Dualsub] ❌ 无法提取有效字幕");
  return $done({});
}

const timeline = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}/g);
if (!timeline) {
  console.log("[Dualsub] ❌ 无法提取时间轴");
  return $done({});
}

console.log(`[Dualsub] ✅ VTT 被抓取成功，共识别 ${dialogue.length} 条字幕`);

const s_sentences = dialogue.map((line, idx) => `~${idx}~${line.replace(/<[^>]+>/g, "").replace(/^.*\n/, "")}`);

function group(list, size) {
  let out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

const grouped = group(s_sentences, 80);

(async () => {
  let trans_result = [];

  for (const chunk of grouped) {
    const options = {
      url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
      headers: {
        "User-Agent": "GoogleTranslate/6.29.0 (iPhone; iOS 15.4)"
      },
      body: `q=${encodeURIComponent(chunk.join("\n"))}`
    };

    try {
      const res = await request(options);
      if (res.sentences) {
        for (const s of res.sentences) {
          if (s.trans) {
            const clean = s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~");
            trans_result.push(clean);
          }
        }
      }
    } catch (e) {
      console.log("[Dualsub] ❌ 翻译失败：" + e);
      return $done({ body });
    }
  }

  if (trans_result.length === 0) {
    console.log("[Dualsub] ⚠️ 翻译返回空结果，跳过");
    return $done({ body });
  }

  const t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  if (!t_sentences) {
    console.log("[Dualsub] ⚠️ 翻译标记匹配失败");
    return $done({ body });
  }

  for (let i in dialogue) {
    const trans = t_sentences.find(t => t.startsWith(`~${i}~`));
    if (!trans) continue;
    const text = trans.replace(/^~\d+~/, "").trim();
    const patt = setting.line === "s"
      ? new RegExp(`(${dialogue[i].replace(/([.*+?^=!:${}()|$begin:math:display$$end:math:display$\/\\])/g, "\\$1")})`)
      : new RegExp(`(${timeline[i]})`);
    body = body.replace(patt, `$1\n${text}`);
  }

  console.log("[Dualsub] ✅ 翻译注入完成");
  $done({ body });
})();

function request(opt) {
  return new Promise((resolve, reject) => {
    $httpClient.post(opt, (err, resp, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject("JSON 解析失败");
      }
    });
  });
}
