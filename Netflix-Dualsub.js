let settings = {
  tl: "zh-CN", // 目标语言：简体中文
  line: "f"    // 英文在上（foreign first），可改为 "s" 中文在上
};

let body = $response.body;

// 若无 body，直接结束
if (!body || typeof body !== "string") {
  $done({});
  return;
}

// ✅ 判断是否为字幕文件（防止误处理视频流）
if (!body.startsWith("WEBVTT")) {
  $done({});
  return;
}

// 替换回车符以统一处理
body = body.replace(/\r/g, "");

// ✅ 提取字幕行
let lines = body.split("\n");
let output = [];
let block = [];

const isTextLine = line => line && !/^\d+$/.test(line) && !/^(\d{2}:){2}\d{2}\.\d{3}/.test(line) && !/^NOTE/.test(line);

async function translate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${settings.tl}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  const data = await response.json();
  return data[0].map(item => item[0]).join("");
}

// ✅ 主处理逻辑
(async () => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 分段处理
    if (line.trim() === "") {
      if (block.length > 0) {
        const outputBlock = [...block];

        // 处理字幕文本部分
        const textLines = block.filter(isTextLine);
        for (let text of textLines) {
          const translated = await translate(text);
          if (settings.line === "f") {
            outputBlock.push(text);       // 原文在上
            outputBlock.push(translated); // 译文在下
          } else {
            outputBlock.push(translated); // 译文在上
            outputBlock.push(text);       // 原文在下
          }
        }

        output.push(...outputBlock, "");
        block = [];
      }
    } else {
      block.push(line);
    }
  }

  $done({ body: output.join("\n") });
})();
