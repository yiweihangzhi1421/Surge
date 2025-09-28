/*
  hulu.js - Dualsub-like script for Hulu (.m3u8 + .vtt)
  固定默认：Google 机翻 -> zh-CN，中文在上、英文在下（line = "f"）
  使用方法：
    1) Surge 配置（示例）：
       [Script]
       Hulu-Dualsub = type=http-response,pattern=^https:\/\/(vodmanifest\.hulustream\.com\/hulu\/v1\/hls\/(vtt|multivariant)\/.+\.m3u8|assets-prod\.hulu\.com\/.+\.vtt)$,requires-body=1,max-size=0,timeout=30,script-path=https://你的raw地址/hulu.js
       [MITM]
       hostname = *.hulustream.com, assets-prod.hulu.com

    2) 本脚本行为：
       - 拦截 hulustream 的字幕清单 m3u8（仅在 Official 模式下有用；机翻模式下直接放行）
       - 拦截 assets-prod.hulu.com 的 .vtt（执行机翻并插入到字幕段落）
*/

let url = $request.url || ""
let headers = $request.headers || {}
let body = $response.body

// 固定配置（写死）
const setting = {
  type: "Google",  // Google | DeepL | Official | External | Disable
  sl: "auto",
  tl: "zh-CN",
  // line = "f": 中文在上、英文在下；"s": 英文在上、中文在下
  line: "f",
  dkey: "null",    // DeepL key（若使用 DeepL 模式再填）
  external_subtitles: "null"
}

// 保护：无 URL 直接退出
if (!url) $done({})

// 1) m3u8 字幕清单：机翻模式不处理，直接放行；Official 如需后续扩展可在此解析
if (/\.m3u8(\?|$)/.test(url)) {
  if (setting.type !== "Official") $done({})
  // Official 模式：此处保留原始 body，不额外处理（最小实现）
  return $done({ body })
}

// 2) 仅处理 .vtt 字幕文件（assets-prod.hulu.com）
if (!/\.vtt(\?|$)/.test(url)) $done({})

// External：若你把完整 vtt 放进 external_subtitles，可直接替换
if (setting.type === "External") {
  if (!setting.external_subtitles || setting.external_subtitles === "null") $done({})
  const external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
  return $done({ body: external })
}

// Official：不做机翻，原样返回
if (setting.type === "Official") $done({ body })

// 没有响应体也直接退出
if (!body) $done({})

// ===== 机翻逻辑（Google / DeepL）=====
async function machineTranslate(provider) {
  // 规范化换行，合并同一时间段内的多行文本，便于单段翻译
  body = body.replace(/\r/g, "")
  body = body
    .replace(/(\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d[^\n]*\n.+)\n(.+)/g, "$1 $2")
    .replace(/(\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d[^\n]*\n.+)\n(.+)/g, "$1 $2")

  // 匹配每个字幕段（时间轴 + 文本）
  const paragraphs = body.match(/\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d[^\n]*\n.+/g)
  if (!paragraphs || paragraphs.length === 0) return $done({ body })

  // 仅取纯文本进行翻译（去除 <c.xxx> 等样式标签）
  const texts = paragraphs.map(p =>
    p.replace(/^\d+:\d\d:\d\d\.\d{3} --> \d+:\d\d:\d\d\.\d[^\n]*\n/, "")
     .replace(/<[^>]+>/g, "")
  )

  const translations = []

  if (provider === "Google") {
    // 逐句请求（更稳；可按需合并批量）
    for (let i = 0; i < texts.length; i++) {
      const options = {
        url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}&ie=UTF-8&oe=UTF-8`,
        headers: { "User-Agent": "GoogleTranslate/6.29.59279 (iPhone)" },
        body: `q=${encodeURIComponent(texts[i])}`
      }
      const trans = await new Promise(resolve => {
        $httpClient.post(options, (err, resp, data) => {
          if (err || !data) return resolve("")
          try {
            const j = JSON.parse(data)
            if (Array.isArray(j.sentences) && j.sentences.length) {
              const joined = j.sentences.map(s => (s.trans || (s.alternatives?.[0]?.trans) || "")).join("")
              return resolve(joined.replace(/\n/g, " "))
            }
            // 兼容老格式
            if (Array.isArray(j[0])) return resolve(j[0].map(x => x?.[0] || "").join(""))
          } catch { /* ignore */ }
          resolve("")
        })
      })
      translations.push(trans)
    }
  } else if (provider === "DeepL") {
    if (!setting.dkey || setting.dkey === "null") return $done({ body })
    for (let i = 0; i < texts.length; i++) {
      const options = {
        url: "https://api-free.deepl.com/v2/translate",
        body: `auth_key=${setting.dkey}&text=${encodeURIComponent(texts[i])}&target_lang=${setting.tl}`
      }
      const trans = await new Promise(resolve => {
        $httpClient.post(options, (err, resp, data) => {
          if (err || !data) return resolve("")
          try {
            const j = JSON.parse(data)
            if (j.translations && j.translations[0]) {
              return resolve((j.translations[0].text || "").replace(/\n/g, " "))
            }
          } catch { /* ignore */ }
          resolve("")
        })
      })
      translations.push(trans)
    }
  }

  // 将翻译插入到每段字幕：line = "f" => 中文在上、英文在下
  let newBody = body
  for (let i = 0; i < paragraphs.length; i++) {
    const trans = translations[i]
    if (!trans) continue
    const orig = paragraphs[i]
    // 段落替换：保持时间轴 + 原文，中文置顶
    const insert = `${trans}\n${orig}`
    newBody = newBody.replace(orig, insert)
  }

  return $done({ body: newBody })
}

// 调用机翻（固定 Google；如改为 DeepL，把 "Google" 换成 "DeepL" 并填 dkey）
if (setting.type === "Google") {
  machineTranslate("Google")
} else if (setting.type === "DeepL") {
  machineTranslate("DeepL")
} else {
  // Disable 或未覆盖到的模式
  $done({ body })
}
