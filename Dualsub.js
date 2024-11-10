/*
    Dualsub for Surge by Neurogram

    - Disney+, Star+, HBO Max, Prime Video, YouTube official bilingual subtitles
    - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. external subtitles
    - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. machine translation bilingual subtitles (Google, DeepL)
    - Customized language support
*/

let url = $request.url
let headers = $request.headers

let default_settings = {
    Disney: { /* ... existing Disney settings ... */ },
    HBOMax: { /* ... existing HBO Max settings ... */ },
    Hulu: { /* ... existing Hulu settings ... */ },
    Netflix: { /* ... existing Netflix settings ... */ },
    Paramount: { /* ... existing Paramount settings ... */ },
    PrimeVideo: { /* ... existing Prime Video settings ... */ },
    Mubi: {
        type: "Google",
        lang: "English",
        sl: "auto",
        tl: "en",
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
    Peacock: {
        type: "Google",
        lang: "English",
        sl: "auto",
        tl: "en",
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
    YouTube: { /* ... existing YouTube settings ... */ }
}

let settings = $persistentStore.read()
if (!settings) settings = default_settings
if (typeof (settings) == "string") settings = JSON.parse(settings)

let service = ""
if (url.match(/(dss|star)ott.com/)) service = "Disney"
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax"
if (url.match(/huluim.com/)) service = "Hulu"
if (url.match(/nflxvideo.net/)) service = "Netflix"
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount"
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo"
if (url.match(/mubicdn.net/)) service = "Mubi"
if (url.match(/peacocktv.com/)) service = "Peacock"
if (url.match(/youtube.com/)) service = "YouTube"

if (!service) $done({})
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
if (!body) $done({})

// Add logic for Mubi and Peacock subtitles
if (url.match(/\.(web)?vtt/) || service == "Netflix" || service == "Mubi" || service == "Peacock") {
    if (service != "Netflix" && url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) {
        $done({ body: setting.subtitles })
    }

    if (setting.type == "Official") {
        if (setting.t_subtitles_url == "null") $done({})
        let subtitles_urls_data = setting.t_subtitles_url.match(/.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")
    if (setting.type == "DeepL") machine_subtitles("DeepL")
    if (setting.type == "External") external_subtitles()
}

function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`)
    if (!setting.external_subtitles.match(patt)) $done({})
    if (!body.match(patt)) $done({})
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
    body = body.replace(patt, external.match(patt)[0])
    $done({ body })
}

async function machine_subtitles(type) {
    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)
    if (!dialogue) $done({})

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)
    let s_sentences = dialogue.map((d, i) => `${type == "Google" ? "~" + i + "~" : "&text="}${d.replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "").replace(/<\/*(c\.[^>]+|i|c)>/g, "")}`)
    s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50)

    let trans_result = []
    if (type == "Google") {
        for (let p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=t&sl=${setting.sl}&tl=${setting.tl}&q=${encodeURIComponent(s_sentences[p].join("\n"))}`,
                headers: { "User-Agent": "GoogleTranslate/6.29.0.02 (iPhone; iOS 15.4; en; iPhone14,2)" }
            }
            let trans = await send_request(options, "get")
            if (trans.sentences) {
                trans.sentences.forEach(sentence => {
                    if (sentence.trans) trans_result.push(sentence.trans.replace(/\n/g, " ").replace(/〜|～/g, "~"))
                })
            }
        }
    }
    if (type == "DeepL") { /* ... DeepL translation logic ... */ }
    if (trans_result.length > 0) {
        let g_t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
        for (let j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`)
            let patt2 = new RegExp(`~${j}~\\s*(.+)`)
            if (g_t_sentences && g_t_sentences[j]) body = body.replace(patt, `$1\n${g_t_sentences[j].replace(/~\d+~/, "").trim()}`)
        }
        settings[service].s_subtitles_url = url
        settings[service].subtitles = body
        settings[service].subtitles_type = setting.type
        settings[service].subtitles_sl = setting.sl
        settings[service].subtitles_tl = setting.tl
        settings[service].subtitles_line = setting.line
        $persistentStore.write(JSON.stringify(settings))
    }
    $done({ body })
}

async function official_subtitles(subtitles_urls_data) {
    let result = []
    for (let k in subtitles_urls_data) {
        let options = { url: subtitles_urls_data[k], headers: headers }
        result.push(await send_request(options, "get"))
    }
    body = body.replace(/\r/g, "").replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)
    for (let i in timeline) {
        let patt = new RegExp(`${timeline[i]}`)
        let dialogue = result.join("\n").match(new RegExp(`${timeline[i]}.+`, "g"))
        if (dialogue) body = body.replace(patt, `$1\n${dialogue[0].split("\n")[1].trim()}`)
    }
    settings[service].s_subtitles_url = url
    settings[service].subtitles = body
    settings[service].subtitles_type = setting.type
    settings[service].subtitles_sl = setting.sl
    settings[service].subtitles_tl = setting.tl
    settings[service].subtitles_line = setting.line
    $persistentStore.write(JSON.stringify(settings))
    $done({ body })
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "get") $httpClient.get(options, (err, res, data) => err ? reject(err) : resolve(JSON.parse(data)))
        if (method == "post") $httpClient.post(options, (err, res, data) => err ? reject(err) : resolve(JSON.parse(data)))
    })
}

function groupAgain(data, num) {
    let result = []
    for (let i = 0; i < data.length; i += num) result.push(data.slice(i, i + num))
    return result
}
