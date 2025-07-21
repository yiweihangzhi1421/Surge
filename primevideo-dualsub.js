// Prime Video 双语字幕脚本（固定 Google 翻译 + 中文在上）
// 由 ChatGPT 定制适配 yiweihangzhi1421/Surge 仓库

let url = $request.url;
let headers = $request.headers;
let body = $response.body;

if (!body) $done({});

const settings = {
  type: "Google", // 使用 Google 翻译
  sl: "auto",      // 源语言自动识别
  tl: "zh-CN",     // 目标语言中文
  line: "f"         // 中文在上，英文在下
};

// 合并字幕行
body = body.replace(/\r/g, "");
body = body.replace(/(\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d+\n.+)\n(.+)/g, "$1 $2");

const dialogue = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d+\n.+/g);
const timeline = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d+/g);

if (!dialogue || !timeline) $done({ body });

let s_sentences = dialogue.map((line, i) => `~${i}~` + line.replace(/<[^>]+>/g, "").replace(/^\d+:.*\n/, ""));
s_sentences = group(s_sentences, 80);

let trans_result = [];

(async () => {
  for (const group of s_sentences) {
    const q = encodeURIComponent(group.join("\n"));
    const res = await $httpClient.post({
      url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&sl=${settings.sl}&tl=${settings.tl}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${q}`
    });

    try {
      const json = JSON.parse(res.body);
      const parts = json[0].map(x => x[0]);
      trans_result.push(...parts.join("").match(/~\d+~[^~]+/g));
    } catch (e) {}
  }

  const t_map = {};
  if (trans_result) {
    for (const entry of trans_result) {
      const match = entry.match(/~(\d+)~(.+)/);
      if (match) t_map[match[1]] = match[2].trim();
    }
  }

  for (let i = 0; i < dialogue.length; i++) {
    const trans = t_map[i];
    if (!trans) continue;
    const patt = new RegExp(`(${timeline[i]})`);
    if (settings.line === "f") body = body.replace(patt, `$1\n${trans}`);
    else body = body.replace(patt, `$1\n${dialogue[i].replace(/^\d+:.*\n/, "").trim()}\n${trans}`);
  }

  $done({ body });
})();

function group(arr, num) {
  const result = [];
  for (let i = 0; i < arr.length; i += num) result.push(arr.slice(i, i + num));
  return result;
}
