// ==UserScript==
// @name         Prime Video Dualsub
// @namespace    https://github.com/yiweihangzhi1421/Surge
// @version      1.0.0
// @description  Prime Video 字幕中英文双语（中文在上，英文在下）自动翻译脚本
// @match        *://*.cloudfront.net/*
// @match        *://*.akamaihd.net/*
// @match        *://*.avi-cdn.net/*
// @match        *://*.pv-cdn.net/*
// @grant        none
// ==/UserScript==

let body = $response.body.replace(/\r/g, "").replace(/<\/*(c\.[^>]+|i|c)>/g, "").trim()
if (!body.startsWith("WEBVTT")) return $done({ body })

function group(arr, size) {
  let out = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

function translateGoogle(q) {
  return new Promise(resolve => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(q)}`
    $httpClient.get(url, (err, resp, data) => {
      if (err || resp.status !== 200) return resolve(null)
      try {
        const json = JSON.parse(data)
        const result = json[0].map(line => line[0])
        resolve(result)
      } catch {
        resolve(null)
      }
    })
  })
}

let blocks = body.split(/\n{2,}/)
let output = ["WEBVTT", ""]
let timelines = []
let originals = []

for (let block of blocks) {
  let lines = block.split("\n")
  if (lines.length < 2) continue
  let time = lines[0].trim()
  let text = lines.slice(1).join(" ").trim()
  if (!text) continue
  timelines.push(time)
  originals.push(text)
}

let groups = group(originals, 20)
let translations = []

;(async () => {
  for (let g of groups) {
    let q = g.join("\n")
    let translated = await translateGoogle(q)
    if (translated) {
      translations.push(...translated)
    } else {
      translations.push(...new Array(g.length).fill(""))
    }
  }

  for (let i = 0; i < timelines.length; i++) {
    output.push(timelines[i])
    if (translations[i]) output.push(translations[i])
    output.push(originals[i])
    output.push("")
  }

  $done({ body: output.join("\n") })
})()
