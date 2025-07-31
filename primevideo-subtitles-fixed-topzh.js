// Prime Video Subtitles Dualsub Script (中文在上，英文在下，Google 翻译)

let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "s" // s: 中文在上
};

let body = $response.body;
if (!body) $done({});

body = body.replace(/\r/g, "");
const blocks = body.split(/\n\n+/);

const timeRegexp = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

const subtitles = [];

for (const block of blocks) {
  const lines = block.trim().split(/\n/);
  if (lines.length < 2) continue;

  const timeLine = lines.find(l => l.includes("-->"));
  if (!timeLine) continue;
  const [start, end] = timeLine.split("-->").map(s => s.trim());

  const textLines = lines.slice(lines.indexOf(timeLine) + 1);
  const text = textLines.join("\\n");

  subtitles.push({ start, end, text });
}

const texts = subtitles.map(sub => sub.text);
const query = texts.join("\\n");

translate(query).then(translated => {
  const translatedLines = translated.split("\\n");
  for (let i = 0; i < subtitles.length; i++) {
    const orig = subtitles[i].text;
    const trans = translatedLines[i] || "";
    subtitles[i].text = setting.line === "s" ? trans + "\\n" + orig : orig + "\\n" + trans;
  }

  const output = subtitles.map((sub, i) => {
    return [i + 1, `${sub.start} --> ${sub.end}`, sub.text, ""].join("\\n");
  }).join("\\n");

  $done({ body: output });
}).catch(() => $done({ body }));

function translate(q) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${setting.sl}&tl=${setting.tl}&q=${encodeURIComponent(q)}`;
  return new Promise((resolve, reject) => {
    $httpClient.get(url, (err, res, data) => {
      if (err) return reject(err);
      try {
        const obj = JSON.parse(data);
        const result = obj[0].map(t => t[0]).join("");
        resolve(result);
      } catch {
        reject("parse error");
      }
    });
  });
}
