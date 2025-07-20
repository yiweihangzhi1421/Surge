/*
    Prime Video DualSub for Surge
    - English to Chinese (via Google Translate)
    - Supports Partial Content (HTTP 206)
    - Dual-line display: English + 中文
    - WebVTT compliant
*/

let url = $request.url
if (!url.match(/\.(cloudfront|akamaihd|avi-cdn|pv-cdn)\.net.*\.vtt$/)) $done({})

const setting = {
    sl: "en",
    tl: "zh-CN"
}

let body = $response.body
if (!body) $done({})

// 清理 WebVTT 标签和多余换行
body = body.replace(/\r/g, "")
body = body.replace(/<\/*(c\.[^>]+|i|b|u|c)>/g, "")
body = body.trim()

let lines = body.split(/\n{2,}/)
let output = ["WEBVTT", ""]

let timeList = []
let enList = []

for (let line of lines) {
    let parts = line.trim().split("\n")
    if (parts.length < 2) continue
    timeList.push(parts[0])
    enList.push(parts.slice(1).join(" ").trim())
}

if (!enList.length) return $done({ body }) // 无字幕内容

let batches = batchGroup(enList, 20)
let zhList = []

;(async () => {
    for (let b of batches) {
        let translated = await translate(b.join("\n"))
        if (translated) zhList.push(...translated)
        else zhList.push(...Array(b.length).fill(""))
    }

    for (let i = 0; i < enList.length; i++) {
        output.push(timeList[i])
        output.push(enList[i])
        if (zhList[i]) output.push(zhList[i])
        output.push("") // 空行分段
    }

    $done({ body: output.join("\n") })
})()

function batchGroup(arr, size) {
    let res = []
    for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size))
    }
    return res
}

function translate(text) {
    return new Promise(resolve => {
        let options = {
            url: `https://translate.google.com/translate_a/single?client=gtx&sl=${setting.sl}&tl=${setting.tl}&dt=t`,
            headers: { "User-Agent": "GoogleTranslate" },
            body: `q=${encodeURIComponent(text)}`
        }
        $httpClient.post(options, (err, resp, data) => {
            if (err) return resolve(null)
            try {
                let result = JSON.parse(data)
                let list = result[0].map(i => i[0])
                resolve(list)
            } catch {
                resolve(null)
            }
        })
    })
}
