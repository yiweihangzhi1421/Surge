let headers = $request.headers;
let url = $request.url;

let body;
try {
  body = typeof $response.body === "string"
    ? $response.body
    : new TextDecoder("utf-8").decode($response.body);
} catch (e) {
  console.log("[Error] 字幕内容无法解码为 UTF-8");
  $done({});
}

let settings = {
  Netflix: {
    type: "Google",
    lang: "English",
    sl: "auto",
    tl: "zh-CN",
    line: "f", // 👈 中文在上方
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
  let
