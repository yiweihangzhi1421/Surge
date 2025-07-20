/*
    Prime Video Subtitle Auto Translate - Dualsub (EN+ZH)
    - Support partial VTT (206)
    - Fallback safe for Surge
*/

let url = $request.url
if (!url.match(/\.(cloudfront|akamaihd|avi-cdn|pv-cdn)\.net.*\.vtt$/)) $done({})

let setting = {
    sl: "en",
    tl: "zh-CN"
}

let body = $response.body
if (!body) $done({})

// 清洗格式
body = body.replace(/\r/g, "")
body = body.replace(/<\/*(c\.[^>]+|i|c)>/g, "")
body = body.trim()

// 拆解区块
let blocks = body.split(/\n{2,}/)
let output = ["WEBVTT", ""]

let timelines = []
let originals = []

for (let block of blocks) {
    let lines = block.split("\n")
    if (lines.length < 2) continue
    let time = lines[0].trim()
    let content = lines.slice(1).join(" ").trim()
    if (content.length === 0) continue
    timelines.push(time)
    originals.push(content)
}

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

    // 重组 VTT
    for (let i = 0; i < timelines.length; i++) {
        output.push(timelines[i])
        output.push(originals[i])
        if (translations[i]) output.push(translations[i])
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

function translateGoogle(q) {
    return new Promise((resolve) => {
        $httpClient.post({
            url: `https://translate.google.com/translate_a/single?client=gtx&sl=${setting.sl}&tl=${setting.tl}&dt=t`,
            headers: { "User-Agent": "Mozilla/5.0" },
            body: `q=${encodeURIComponent(q)}`
        }, (err, resp, data) => {
            if (err) return resolve(null)
            try {
                let json = JSON.parse(data)
                let lines = json[0].map(i => i[0])
                resolve(lines)
            } catch {
                resolve(null)
            }
        })
    })
}
