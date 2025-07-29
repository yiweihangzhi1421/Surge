const tl = "zh-CN";       // 翻译目标语言（简体中文）
const lineOrder = "f";    // "f": 英文在上，"s": 中文在上

let body = $response.body;

// 非字幕内容直接跳过
if (
  !body ||
  !body.includes("-->") ||
  !body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}/)
) {
  $done({ body });
}

body = body.replace(/\r/g, "");
body = body.replace(/(\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n.+)\n(.+)/g, "$1 $2");

let dialogue = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n.+/g);
let timeline = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+/g);
if (!dialogue) $done({ body });

let s_sentences = [];
let idList = [];

for (let i in dialogue) {
  let clean = dialogue[i]
    .replace(/<\/*(c\.[^>]+|i|c)>/g, "")
    .replace(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d{3}.+\n/, "");

  // 跳过已有中文的字幕
  if (/[\u4e00-\u9fa5]/.test(clean)) continue;

  s_sentences.push("~" + i + "~" + clean);
  idList.push(i);
}

if (s_sentences.length === 0) $done({ body });

s_sentences = groupAgain(s_sentences, 80);

let t_sentences = [];
let trans_result = [];

function groupAgain(data, num) {
  let result = [];
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num));
  }
  return result;
}

async function main() {
  for (let group of s_sentences) {
    let query = group.join("\n");
    let options = {
      url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&dj=1&sl=auto&tl=${tl}`,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `q=${encodeURIComponent(query)}`
    };

    await new Promise((resolve) => {
      $httpClient.post(options, (err, resp, data) => {
        if (err) return resolve();
        try {
          const json = JSON.parse(data);
          const detectedLang = json.src;
          if (detectedLang !== "en") return resolve(); // 跳过非英文

          if (json.sentences) {
            for (let s of json.sentences) {
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
        } catch (e) {}
        resolve();
      });
    });
  }

  if (trans_result.length > 0) {
    t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
  }

  if (t_sentences && t_sentences.length > 0) {
    let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");
    for (let j of idList) {
      let patt = new RegExp(`(${timeline[j]})`);
      if (lineOrder === "s") {
        patt = new RegExp(`(${dialogue[j].replace(/([()[\]?])/g, "\\$1")})`);
      }

      let patt2 = new RegExp(`~${j}~\\s*(.+)`);
      if (g_t_sentences.match(patt2)) {
        body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
      }
    }
  }

  $done({ body });
}

main();
