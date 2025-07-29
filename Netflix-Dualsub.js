let headers = $request.headers
let url = $request.url

let settings = {
  Netflix: {
    type: "Google",
    lang: "English",
    sl: "auto",
    tl: "zh-CN",
    line: "f", // f: 英文在上，中文在下；s: 中文在上，英文在下
    dkey: "null"
  }
}

let body = $response.body
if (!body || !body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+\n.+/g)) $done({ body })
if (settings.Netflix.type !== "Google") $done({ body })

body = body.replace(/\r/g, "")
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)
if (!dialogue) $done({ body })

let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

let s_sentences = []
for (let i in dialogue) {
  let clean = dialogue[i]
    .replace(/<\/*(c\.[^>]+|i|c)>/g, "")
    .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")
  s_sentences.push("~" + i + "~" + clean)
}

s_sentences = groupAgain(s_sentences, 80)

let t_sentences = []
let trans_result = []

function groupAgain(data, num) {
  let result = []
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num))
  }
  return result
}

async function main() {
  for (let p in s_sentences) {
    let postBody = `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
    let options = {
      url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.Netflix.sl}&tl=${settings.Netflix.tl}`,
      headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded" },
      body: postBody
    }

    await new Promise((resolve) => {
      $httpClient.post(options, (err, resp, data) => {
        if (err) return resolve()
        try {
          let trans = JSON.parse(data)
          if (trans.sentences) {
            for (let s of trans.sentences) {
              if (s.trans) {
                trans_result.push(s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
              }
            }
          }
        } catch (e) {}
        resolve()
      })
    })
  }

  if (trans_result.length > 0) {
    t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
  }

  if (t_sentences && t_sentences.length > 0) {
    let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")
    for (let j in dialogue) {
      let patt = new RegExp(`(${timeline[j]})`)
      if (settings.Netflix.line === "s") {
        patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)
      }

      let patt2 = new RegExp(`~${j}~\\s*(.+)`)
      if (g_t_sentences.match(patt2)) {
        body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)
      }
    }
  }

  $done({ body })
}

main()
