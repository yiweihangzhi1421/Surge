let url = $request.url
let headers = $request.headers

let default_settings = {
    Hulu: {
        type: "External", // 使用外部字幕
        lang: "English",
        sl: "auto",
        tl: "zh-CN", // 翻译成简体中文
        line: "s",   // 单行字幕
        dkey: "null", // DeepL API 密钥（如果需要）
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "http://example.com/external_subtitles.vtt" // 外部字幕 URL
    },
    MUBI: {
        type: "Google", // 使用 Google 翻译
        lang: "English",
        sl: "auto",
        tl: "zh-CN", // 翻译成简体中文
        line: "s",   // 单行字幕
        dkey: "null", // DeepL API 密钥（如果需要）
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    Peacock: {
        type: "Google", // 使用 Google 翻译
        lang: "English",
        sl: "auto",
        tl: "zh-CN", // 翻译成简体中文
        line: "s",   // 单行字幕
        dkey: "null", // DeepL API 密钥（如果需要）
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    }
}

let settings = $persistentStore.read()

if (!settings) settings = default_settings

if (typeof (settings) == "string") settings = JSON.parse(settings)

let service = ""
if (url.match(/peacocktv.com/)) service = "Peacock"
if (url.match(/mubicdn.net/)) service = "MUBI"
if (url.match(/huluim.com/)) service = "Hulu"

if (!service) $done({})

if (!settings[service]) settings[service] = default_settings[service]
let setting = settings[service]

if (service == "Peacock") {
    // 处理 Peacock TV 字幕请求
    let subtitles_url = url.match(/(.+\.webvtt)/)[1]
    let options = {
        url: subtitles_url,
        headers: headers
    }

    $httpClient.get(options, function(error, response, data) {
        if (error) return $done({})

        // 这里处理字幕内容，可以根据设置的 `tl` 翻译成指定语言
        let translatedSubtitles = translateSubtitles(data, setting.tl)
        $done({ body: translatedSubtitles })
    })
}

if (service == "MUBI") {
    // 处理 MUBI 字幕请求
    let subtitles_url = url.match(/(.+\.webvtt)/)[1]
    let options = {
        url: subtitles_url,
        headers: headers
    }

    $httpClient.get(options, function(error, response, data) {
        if (error) return $done({})

        // 这里处理字幕内容，可以根据设置的 `tl` 翻译成指定语言
        let translatedSubtitles = translateSubtitles(data, setting.tl)
        $done({ body: translatedSubtitles })
    })
}

if (service == "Hulu") {
    // 处理 Hulu 字幕请求
    let subtitles_url = url.match(/(.+\.vtt)/)[1]
    let options = {
        url: subtitles_url,
        headers: headers
    }

    $httpClient.get(options, function(error, response, data) {
        if (error) return $done({})

        // 这里处理字幕内容，可以根据设置的 `tl` 翻译成指定语言
        let translatedSubtitles = translateSubtitles(data, setting.tl)
        $done({ body: translatedSubtitles })
    })
}

// 翻译字幕函数
function translateSubtitles(subtitles, targetLang) {
    // 假设是 Google 翻译的简单实现
    return subtitles.replace(/(字幕内容)/g, `翻译后的内容(${targetLang})`)
}
