/*
    Dualsub for Peacock iOS
    Enhanced with gzip support and improved headers handling
*/

let url = $request.url
let headers = $request.headers

let default_settings = {
    Peacock: {
        type: "Google",
        lang: "Chinese",
        sl: "auto",
        tl: "zh-CN",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    YouTube: {
        type: "Enable",
        lang: "Chinese",
        sl: "auto",
        tl: "zh-CN",
        line: "sl"
    }
}

let settings = $persistentStore.read()

console.log("[Dualsub] Starting subtitle processing")
console.log("[Dualsub] URL:", url)

if (!settings) {
    console.log("[Dualsub] No settings found, using defaults")
    settings = default_settings
}

if (typeof (settings) == "string") {
    try {
        settings = JSON.parse(settings)
    } catch (e) {
        console.log("[Dualsub] Error parsing settings:", e)
        $done({})
    }
}

let service = ""
if (url.match(/peacocktv\.com/)) {
    service = "Peacock"
    console.log("[Dualsub] Detected Peacock service")
}
if (url.match(/youtube\.com/)) service = "YouTube"

if (!service) {
    console.log("[Dualsub] No supported service detected")
    $done({})
}

if (!settings[service]) settings[service] = default_settings[service]
let setting = settings[service]

if (url.match(/action=get/)) {
    delete setting.t_subtitles_url
    delete setting.subtitles
    delete setting.external_subtitles
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } })
}
if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body)
    if (new_setting.type != "External") settings[service].external_subtitles = "null"
    if (new_setting.type == "Reset") new_setting = default_settings[service]
    if (new_setting.service && service == "General") settings[service].service = new_setting.service.replace(/\r/g, "")
    if (new_setting.type) settings[service].type = new_setting.type
    if (new_setting.lang) settings[service].lang = new_setting.lang
    if (new_setting.sl) settings[service].sl = new_setting.sl
    if (new_setting.tl) settings[service].tl = new_setting.tl
    if (new_setting.line) settings[service].line = new_setting.line
    if (new_setting.dkey && service != "YouTube") settings[service].dkey = new_setting.dkey
    if (new_setting.s_subtitles_url) settings[service].s_subtitles_url = new_setting.s_subtitles_url
    if (new_setting.t_subtitles_url) settings[service].t_subtitles_url = new_setting.t_subtitles_url
    if (new_setting.subtitles) settings[service].subtitles = new_setting.subtitles
    if (new_setting.subtitles_type) settings[service].subtitles_type = new_setting.subtitles_type
    if (new_setting.subtitles_sl) settings[service].subtitles_sl = new_setting.subtitles_sl
    if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.subtitles_tl
    if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line
    if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "")
    $persistentStore.write(JSON.stringify(settings))
    delete settings[service].t_subtitles_url
    delete settings[service].subtitles
    delete settings[service].external_subtitles
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } })
}

if (setting.type == "Disable") $done({})

let body = $response.body

if (!body) {
    console.log("[Dualsub] No response body found")
    $done({})
}

// 处理gzip压缩的内容
if ($response.headers['Content-Encoding'] === 'gzip') {
    try {
        body = $surge.ungzip(body)
        console.log("[Dualsub] Successfully uncompressed gzip content")
    } catch (e) {
        console.log("[Dualsub] Error uncompressing content:", e)
        $done({})
    }
}

if (service == "YouTube") {
    let patt = new RegExp(`lang=${setting.tl}`)
    
    if (url.replace(/&lang=zh(-Hans)*&/, "&lang=zh-CN&").replace(/&lang=zh-Hant&/, "&lang=zh-TW&").match(patt) || url.match(/&tlang=/)) $done({})
    
    let t_url = `${url}&tlang=${setting.tl == "zh-CN" ? "zh-Hans" : setting.tl == "zh-TW" ? "zh-Hant" : setting.tl}`
    
    let options = {
        url: t_url,
        headers: {
            'Accept': '*/*',
            'User-Agent': 'AppleCoreMedia/1.0.0.21H16',
            'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
            'Accept-Encoding': 'identity'
        }
    }
    
    $httpClient.get(options, function (error, response, data) {
        if (error) {
            console.log("[Dualsub] Request error:", error)
            $done({})
            return
        }
        
        if (setting.line == "sl") $done({ body: data })
        let timeline = body.match(/<p t="\d+" d="\d+">/g)
        
        if (url.match(/&kind=asr/)) {
            body = body.replace(/<\/?s[^>]*>/g, "")
            data = data.replace(/<\/?s[^>]*>/g, "")
            timeline = body.match(/<p t="\d+" d="\d+"[^>]+>/g)
        }
        
        for (var i in timeline) {
            let patt = new RegExp(`${timeline[i]}([^<]+)<\\/p>`)
            if (body.match(patt) && data.match(patt)) {
                if (setting.line == "s") body = body.replace(patt, `${timeline[i]}$1\n${data.match(patt)[1]}</p>`)
                if (setting.line == "f") body = body.replace(patt, `${timeline[i]}${data.match(patt)[1]}\n$1</p>`)
            }
        }
        
        $done({ body })
    })
}

if (url.match(/\.(web)?vtt/) || service == "Peacock") {
    console.log("[Dualsub] Processing VTT subtitle")
    
    if (service != "Netflix" && url == setting.s_subtitles_url && 
        setting.subtitles != "null" && 
        setting.subtitles_type == setting.type && 
        setting.subtitles_sl == setting.sl && 
        setting.subtitles_tl == setting.tl && 
        setting.subtitles_line == setting.line) {
        console.log("[Dualsub] Using cached subtitles")
        $done({ body: setting.subtitles })
    }

    if (setting.type == "Google") {
        console.log("[Dualsub] Using Google Translate")
        machine_subtitles("Google")
    }

    if (setting.type == "DeepL") machine_subtitles("DeepL")

    if (setting.type == "External") external_subtitles()
}
function external_subtitles() {
    console.log("[Dualsub] Processing external subtitles")
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`)
    if (!setting.external_subtitles.match(patt)) $done({})
    if (!body.match(patt)) $done({})
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
    body = body.replace(patt, external.match(patt)[0])
    $done({ body })
}

async function machine_subtitles(type) {
    console.log("[Dualsub] Starting translation process")
    try {
        // 清理和标准化字幕文本
        body = body.replace(/\r/g, "")
        body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
        body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

        let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)

        if (!dialogue) {
            console.log("[Dualsub] No dialogue found in subtitles")
            $done({})
            return
        }

        console.log("[Dualsub] Found", dialogue.length, "subtitle entries")

        let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

        let s_sentences = []
        for (var i in dialogue) {
            s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
        }
        
        // 根据翻译服务调整批量大小
        s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50)
        console.log("[Dualsub] Prepared", s_sentences.length, "translation batches")

        let t_sentences = []
        let trans_result = []

        if (type == "Google") {
            for (var p in s_sentences) {
                let options = {
                    url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                    headers: {
                        'Accept': '*/*',
                        'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)',
                        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
                        'Accept-Encoding': 'identity'
                    },
                    body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
                }

                try {
                    let trans = await send_request(options, "post")
                    console.log("[Dualsub] Translated batch", parseInt(p) + 1, "of", s_sentences.length)

                    if (trans.sentences) {
                        let sentences = trans.sentences
                        for (var k in sentences) {
                            if (sentences[k].trans) {
                                trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
                            }
                        }
                    }
                } catch (error) {
                    console.log("[Dualsub] Translation error:", error)
                    continue
                }
            }

            if (trans_result.length > 0) {
                t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
                console.log("[Dualsub] Successfully translated", trans_result.length, "sentences")
            }
        }

        if (type == "DeepL") {
            for (var l in s_sentences) {
                let options = {
                    url: "https://api-free.deepl.com/v2/translate",
                    body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
                }

                try {
                    let trans = await send_request(options, "post")
                    if (trans.translations) trans_result.push(trans.translations)
                } catch (error) {
                    console.log("[Dualsub] DeepL translation error:", error)
                    continue
                }
            }

            if (trans_result.length > 0) {
                for (var o in trans_result) {
                    for (var u in trans_result[o]) {
                        t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "))
                    }
                }
            }
        }

        if (t_sentences.length > 0) {
            let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")

            for (var j in dialogue) {
                let patt = new RegExp(`(${timeline[j]})`)
                if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)

                let patt2 = new RegExp(`~${j}~\\s*(.+)`)

                if (g_t_sentences.match(patt2) && type == "Google") body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)

                if (type == "DeepL") body = body.replace(patt, `$1\n${t_sentences[j]}`)
            }

            if (service != "Netflix") {
                settings[service].s_subtitles_url = url
                settings[service].subtitles = body
                settings[service].subtitles_type = setting.type
                settings[service].subtitles_sl = setting.sl
                settings[service].subtitles_tl = setting.tl
                settings[service].subtitles_line = setting.line
                $persistentStore.write(JSON.stringify(settings))
                console.log("[Dualsub] Cached translated subtitles")
            }

            console.log("[Dualsub] Successfully completed translation")
        }

        $done({ body })

    } catch (error) {
        console.log("[Dualsub] Error in machine_subtitles:", error)
        $done({})
    }
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) {
                    console.log("[Dualsub] Request error:", error)
                    return reject('Error')
                }
                resolve(data)
            })
        }

        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) {
                    console.log("[Dualsub] Request error:", error)
                    return reject('Error')
                }
                try {
                    let parsed = JSON.parse(data)
                    resolve(parsed)
                } catch (e) {
                    console.log("[Dualsub] JSON parse error:", e)
                    reject(e)
                }
            })
        }
    })
}

function groupAgain(data, num) {
    var result = []
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num))
    }
    return result
}
