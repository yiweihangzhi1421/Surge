let url = $request.url
let headers = $request.headers

let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "s"
}

let body = $response.body
if (!body) $done({})

const isNetflix = url.includes("nflxvideo.net")
const isPrime = /\.(cloudfront|akamaihd|avi-cdn|pv-cdn)\.net/.test(url)

if (!isNetflix && !isPrime) $done({})
if (!url.match(/\.(web)?vtt/)) $done({})

body = body.replace(/\r/g, "")
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)
if (!dialogue) $done({})

let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

let s_sentences = []
for (let i in dialogue) {
  s_sentences.push(`~${i}~${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
}
s_sentences = groupAgain(s_sentences, 80)

let t_sentences = []
let trans_result = []

;(async () => {
  for (let p in s_sentences) {
    let options = {
      url: `https://translate.google.com/translate_a/single?client=it&dt=t&dt=ss&dj=1&sl=${setting.sl}&tl=${setting.tl}`,
      headers: {
        "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
    }
    let trans = await send_request(options, "post")
    if (trans.sentences) {
      for (let k in trans.sentences) {
        if (trans.sentences[k].trans)
          trans_result.push(trans.sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
      }
    }
  }

  if (trans_result.length > 0) {
    t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
  }

  if (t_sentences.length > 0) {
    let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")
    for (let j in dialogue) {
      let patt = new RegExp(`(${timeline[j]})`)
      if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)
      let patt2 = new RegExp(`~${j}~\\s*(.+)`)

      if (g_t_sentences.match(patt2)) {
        body = body.replace(patt, `${g_t_sentences.match(patt2)[1]}\n$1`)
      }
    }
  }

  $done({ body })
})()

function send_request(options, method) {
  return new Promise((resolve, reject) => {
    if (method == "get") {
      $httpClient.get(options, function (error, response, data) {
        if (error) return reject("Error")
        resolve(data)
      })
    }
    if (method == "post") {
      $httpClient.post(options, function (error, response, data) {
        if (error) return reject("Error")
        resolve(JSON.parse(data))
      })
    }
  })
}

function groupAgain(data, num) {
  let result = []
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num))
  }
  return result
}
