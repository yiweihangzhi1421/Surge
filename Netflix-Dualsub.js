let url = $request.url;
let headers = $request.headers;

let default_settings = {
  Netflix: {
    type: "Google",
    lang: "English",
    sl: "auto",
    tl: "zh-CN",
    line: "f", // 中文在上
    dkey: "null",
    s_subtitles_url: "null",
    t_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null",
    external_subtitles: "null"
  }
};

let settings = $persistentStore.read();
if (!settings) settings = default_settings;
if (typeof settings === "string") settings = JSON.parse(settings);

let service = "";
if (url.includes("nflxvideo.net")) service = "Netflix";
if (!service) $done({});

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

let body = $response.body;
if (!body) $done({});

// 🔒 自动跳过非字幕内容（如视频音频块）
if (!body.includes("WEBVTT") && !body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}/)) {
  console.log("[Dualsub] ⛔️ 内容不是字幕，已跳过");
  $done({});
}

// 🧹 清理标签、样式字段，标准化文本
body = body.replace(/\r/g, "")
           .replace(/<\/*(c\.[^>]+|i|b|u|c)>/g, "")
           .replace(/(\\d+:\\d\\d:\\d\\d\\.\\d{3} --> \\d+:\\d\\d:\\d\\d\\.\\d{3}).*\\n/g, "$1\n");

let blocks = body.split("\n\n");
let timeline = [], sents = [];

for (let block of blocks) {
  let lines = block.trim().split("\n");
  if (lines.length >= 2) {
    timeline.push(lines[0] + "\n" + lines[1]);
    sents.push(lines.slice(2).join(" ").trim());
  }
}

if (sents.length === 0) $done({ body });

function groupData(data, size) {
  let result = [];
  for (let i = 0; i < data.length; i += size) result.push(data.slice(i, i + size));
  return result;
}

(async () => {
  console.log("[Dualsub] 👀 正在翻译 Netflix 字幕，共", sents.length, "句");
  let trans_result = [];
  let grouped = groupData(sents.map((s, i) => `~${i}~${s}`), 50);

  for (let group of grouped) {
    let res = await new Promise((resolve) => {
      $httpClient.post({
        url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
        headers: { "User-Agent": "Mozilla/5.0 (Surge-Dualsub)" },
        body: "q=" + encodeURIComponent(group.join("\n"))
      }, (err, resp, data) => {
        if (err) {
          console.log("[Dualsub] ❌ 翻译请求失败");
          resolve({ sentences: [] });
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    if (res.sentences) {
      trans_result.push(...res.sentences.map(s => s.trans.replace(/~|～/g, "~")));
    }
  }

  let merged = trans_result.join(" ").match(/~\d+~[^~]+/g);
  if (!merged) return $done({ body });

  for (let i in merged) {
    let id = parseInt(merged[i].match(/~(\d+)~/)?.[1]);
    let translated = merged[i].replace(/~\d+~/, "").trim();
    if (typeof timeline[id] !== "undefined") {
      console.log(`[Dualsub] ✅ ${sents[id]} → ${translated}`);
      if (setting.line === "f") {
        body = body.replace(timeline[id], `${timeline[id]}\n${translated}`);
      } else {
        body = body.replace(timeline[id], `${timeline[id]}\n${sents[id]}\n${translated}`);
      }
    }
  }

  $done({ body });
})();
