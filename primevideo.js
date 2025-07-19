/*
    Dualsub for Surge - Prime Video
    Features:
    - Auto-translate English VTT subtitles to Chinese
    - Dual-line display: English + 中文
    - Fully compliant WebVTT format
*/

let url = $request.url
if (!url.match(/\.(cloudfront|akamaihd|avi-cdn|pv-cdn)\.net.*\.vtt$/)) $done({})

let setting = {
    sl: "en",
    tl: "zh-CN"
}

let body = $response.body
if (!body) $done({})

// 清理格式
body = body.replace(/\r/g, "")
body = body.replace(/<\/*(c\.[^>]+|i|c)>/g, "")
body = body.trim()

// 提取字幕块
let blocks = body.split(/\n{2,}/)
let output = ["WEBVTT", ""]

let timelines = []
let originals = []

for (let block of blocks) {
    let lines = block.trim().split("\n")
    if (!lines[0].includes("-->") || lines.length < 2) continue
    let time = lines[0].trim()
    let content = lines.slice(1).join(" ").trim()
    if (!content) continue
    timelines.push(time)
    originals.push(content)
}

// 分批翻译
let groups = group(originals, 20)
let translations = []

;(async () => {
    for (let groupLines of groups) {
        let q = groupLines.join("\n")
        let res = await translateGoogle(q)
        if (res) {
            translations.push(...res)
        } else {
            translations.push(...new Array(groupLines.length).fill(""))
        }
    }

    for (let i = 0; i < timelines.length; i++) {
        output.push(timelines[i])
        output.push(originals[i])
        output.push(translations[i] || "")
        output.push("")
    }

    $done({ body: output.join("\n") })
})()

function group(arr, size) {
    let result = []
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size))
    }
    return result
}

async function translateGoogle(q) {
    let options = {
        url: `https://translate.google.com/translate_a/single?client=gtx&sl=${setting.sl}&tl=${setting.tl}&dt=t`,
        headers: { "User-Agent": "GoogleTranslate" },
        body: `q=${encodeURIComponent(q)}`
    }

    return new Promise((resolve) => {
        $httpClient.post(options, (err, resp, data) => {
            if (err) return resolve(null)
            try {
                let obj = JSON.parse(data)
                let lines = obj[0].map(i => i[0])
                resolve(lines)
            } catch {
                resolve(null)
            }
        })
    })
}
