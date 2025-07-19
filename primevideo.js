/*
    Dualsub for Surge (Prime Video only, fixed format + full translation)
    Features:
    - Support Prime Video subtitle (.vtt) injection
    - English to Chinese (Google Translate)
    - Dual-line display (EN on top, CN below)
    - No persistent setting storage, no Shortcuts required
    - Ensures WebVTT format validity with WEBVTT header and blank lines
*/

let url = $request.url
let headers = $request.headers

if (!url.match(/\.(cloudfront|akamaihd|avi-cdn|pv-cdn)\.net.*\.vtt$/)) $done({})

let setting = {
    type: "Google",
    sl: "en",
    tl: "zh-CN",
    line: "f"
}

let body = $response.body
if (!body) $done({})

body = body.replace(/\r/g, "")
body = body.replace(/(\d+:.+ --> \d+:.+\n.+)\n(.+)/g, "$1 $2")
body = body.replace(/(\d+:.+ --> \d+:.+\n.+)\n(.+)/g, "$1 $2")

let dialogue = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d.+\n.+/g)
if (!dialogue) $done({})

let timeline = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d.+/g)

let s_sentences = []
for (let i in dialogue) {
    s_sentences.push("~" + i + "~" + dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d.+\n/, ""))
}
s_sentences = groupAgain(s_sentences, 20)

let trans_result = []

;(async () => {
    for (let p in s_sentences) {
        let success = false
        let retries = 2
        while (!success && retries > 0) {
            try {
                let options = {
                    url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                    headers: {
                        "User-Agent": "GoogleTranslate/6.29.59279"
                    },
                    body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
                }
                let trans = await send_request(options, "post")
                if (trans.sentences) {
                    for (let s of trans.sentences) {
                        if (s.trans) trans_result.push(s.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
                    }
                }
                success = true
            } catch (e) {
                retries--
            }
        }
    }

    let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
    if (!t_sentences) return $done({ body })

    let trans_map = {}
    for (let ts of t_sentences) {
        let match = ts.match(/~(\d+)~(.+)/)
        if (match) trans_map[match[1]] = match[2]
    }

    let output = ["WEBVTT\n"]
    for (let j in dialogue) {
        output.push(timeline[j])
        let orig = dialogue[j].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d.+\n/, "").trim()
        let trans = trans_map[j] || ""
        if (setting.line === "f") {
            output.push(orig)
            if (trans) output.push(trans)
        } else {
            if (trans) output.push(trans)
            output.push(orig)
        }
        output.push("") // blank line between entries
    }

    $done({ body: output.join("\n") })
})()

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "get") {
            $httpClient.get(options, function (err, res, data) {
                if (err) return reject("Error")
                resolve(data)
            })
        }
        if (method == "post") {
            $httpClient.post(options, function (err, res, data) {
                if (err) return reject("Error")
                try {
                    resolve(JSON.parse(data))
                } catch {
                    reject("Invalid JSON")
                }
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
