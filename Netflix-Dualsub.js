let url = typeof $request !== "undefined" ? $request.url : "";
let rawBody = $response.body;
let body = "";

try {
  if (typeof rawBody === "string") {
    body = rawBody;
  } else if (typeof TextDecoder !== "undefined") {
    body = new TextDecoder("utf-8").decode(rawBody);
  } else {
    console.log("TextDecoder 不可用");
    $done({});
  }
} catch (e) {
  console.log("解码失败：" + e);
  $done({});
  return;
}

if (!body || !body.includes(" --> ")) {
  $done({});
  return;
}

let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "s" // 英上中下
};

translate();

async function translate() {
  body = body.replace(/\r/g, "");
  body = body.replace(/(\d+:\d\d:\d\d\.\d{3} --> .+\n.+)\n(.+)/g, "$1 $2");

  const timeline = body.match(/\d+:\d\d:\d\d\.\d{3} --> .+/g);
  const dialogue = body.match(/\d+:\d\d:\d\d\.\d{3} --> .+\n.+/g);
  if (!dialogue || !timeline) {
    $done({});
    return;
  }

  let s_sentences = dialogue.map((line, i) => `~${i}~${line.replace(/\d+:\d\d:\d\d\.\d{3} --> .+\n/, "")}`);
  s_sentences = group(s_sentences, 80);

  let t_sentences = [];
  for (const group of s_sentences) {
    let res = await googleTranslate(group.join("\n"));
    if (res.sentences) {
      res.sentences.forEach((s) => {
        if (s.trans) t_sentences.push(s.trans.replace(/〜|～/g, "~"));
      });
    }
  }

  const translated = t_sentences.join(" ").match(/~\d+~[^~]+/g);
  if (!translated) {
    $done({});
    return;
  }

  for (let j in dialogue) {
    let t_line = translated.find((x) => x.startsWith(`~${j}~`));
    if (!t_line) continue;
    let chinese = t_line.replace(`~${j}~`, "").trim();
    let patt = new RegExp(`(${timeline[j]}(\\n.+)+)`);
    body = body.replace(patt, `$1\n${chinese}`);
  }

  $done({ body });
}

function googleTranslate(query) {
  return $task.fetch({
    url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}`,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(query)}`
  }).then(resp => {
    try {
      return JSON.parse(resp.body);
    } catch {
      return {};
    }
  });
}

function group(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
