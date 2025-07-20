/*
    Prime Dualsub Script for Surge
    - 支持 Partial Content
    - 批量翻译每段字幕
    - 自动插入双语显示（英文 + 中文）
*/

let url = $request.url
if (!url.match(/\.(cloudfront|akamaihd|avi-cdn|pv-cdn)\.net.*\.vtt$/)) $done({})

if ($response.status !== 200 && $response.status !== 206) $done({})

let body = $response.body
if (!body) $done({})

body = body.replace(/\r/g, "")
body = body.replace(/<\/*(c\.[^>]+|i|c)>/g, "").trim()

let blocks = body.split(/\n{2,}/)
let output = ["WEBVTT", ""]
let times = []
let texts = []

for (let b of blocks) {
    let lines = b.split("\n")
    if (lines.length < 2) continue
    times.push(lines[0].trim())
    texts.push(lines.slice(1).join(" ").trim())
}

let batches = batch(texts, 20)
let translations = []

;(async () => {
    for (let part of batches) {
        let res = await translate(part.join("\n"))
        if (res) {
            translations.push(...res)
        } else {
            translations.push(...new Array(part.length).fill(""))
        }
    }

    for (let i = 0; i < times.length; i++) {
        output.push(times[i])
        output.push(texts[i])
        if (translations[i]) output.push(translations[i])
        output.push("")
    }

    $done({ body: output.join("\n") })
})()

function batch(arr, size) {
    let out = []
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size))
    }
    return out
}

function translate(q) {
    return new Promise(resolve => {
        let options = {
            url: "https://translate.google.com/translate_a/single?client=gtx&dt=t&sl=en&tl=zh-CN",
            headers: { "User-Agent": "GoogleTranslate" },
            body: "q=" + encodeURIComponent(q)
        }
        $httpClient.post(options, (err, res, data) => {
            if (err) return resolve(null)
            try {
                let parsed = JSON.parse(data)
                let lines = parsed[0].map(i => i[0])
                resolve(lines)
            } catch {
                resolve(null)
            }
        })
    })
}
