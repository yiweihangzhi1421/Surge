/*
    Dualsub for Surge by Neurogram
    
    Modified settings:
    - Default to Google Translate
    - Auto detect source language
    - Target language: Chinese
    - Translation on second line
    
    Supported Services:
    - Disney+, Star+, HBO Max, Prime Video
    - YouTube official bilingual subtitles
    - Netflix, Hulu, Paramount+
*/

let url = $request.url
let headers = $request.headers

let default_settings = {
    Disney: {
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
    HBOMax: {
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
    Hulu: {
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
    Netflix: {
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
    Paramount: {
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
    PrimeVideo: {
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
    General: {
        service: "null",
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

if (!settings) settings = default_settings

if (typeof (settings) == "string") settings = JSON.parse(settings)

let service = ""
if (url.match(/(dss|star)ott.com/)) service = "Disney"
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax"
if (url.match(/huluim.com/)) service = "Hulu"
if (url.match(/nflxvideo.net/)) service = "Netflix"
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount"
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo"
if (url.match(/general.media/)) service = "General"
if (url.match(/youtube.com/)) service = "YouTube"

if (settings.General) {
    let general_service = settings.General.service.split(", ")
    for (var s in general_service) {
        let patt = new RegExp(general_service[s])
        if (url.match(patt)) {
            service = "General"
            break
        }
    }
}

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

if (setting.type != "Official" && url.match(/\.m3u8/)) $done({})

let body = $response.body

if (!body) $done({})

if (service == "YouTube") {

    let patt = new RegExp(`lang=${setting.tl}`)

    if (url.replace(/&lang=zh(-Hans)*&/, "&lang=zh-CN&").replace(/&lang=zh-Hant&/, "&lang=zh-TW&").match(patt) || url.match(/&tlang=/)) $done({})

    let t_url = `${url}&tlang=${setting.tl == "zh-CN" ? "zh-Hans" : setting.tl == "zh-TW" ? "zh-Hant" : setting.tl}`

    let options = {
        url: t_url,
        headers: headers
    }

    $httpClient.get(options, function (error, response, data) {

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

let subtitles_urls_data = setting.t_subtitles_url

if (setting.type == "Official" && url.match(/\.m3u8/)) {
    settings[service].t_subtitles_url = "null"
    $persistentStore.write(JSON.stringify(settings))

    let patt = new RegExp(`TYPE=SUBTITLES.+NAME="${setting.tl.replace(/(\[|\]|\(|\))/g, "\\$1")}.+URI="([^"]+)`)

    if (body.match(patt)) {

        let host = ""
        if (service == "Disney") host = url.match(/https.+media.(dss|star)ott.com\/ps01\/disney\/[^\/]+\//)[0]

        let subtitles_data_link = `${host}${body.match(patt)[1]}`

        if (service == "PrimeVideo") {
            correct_host = subtitles_data_link.match(/https:\/\/(.+(cloudfront|akamaihd|avi-cdn).net)/)[1]
            headers.Host = correct_host
        }

        let options = {
            url: subtitles_data_link,
            headers: headers
        }

        $httpClient.get(options, function (error, response, data) {
            let subtitles_data = ""
            if (service == "Disney") subtitles_data = data.match(/.+-MAIN.+\.vtt/g)
            if (service == "HBOMax") subtitles_data = data.match(/http.+\.vtt/g)
            if (service == "PrimeVideo") subtitles_data = data.match(/.+\.vtt/g)

            if (service == "Disney") host = host + "r/"
            if (service == "PrimeVideo") host = subtitles_data_link.match(/https.+\//)[0]

            if (subtitles_data) {
                subtitles_data = subtitles_data.join("\n")
                if (service == "Disney" || service == "PrimeVideo") subtitles_data = subtitles_data.replace(/(.+)/g, `${host}$1`)
                settings[service].t_subtitles_url = subtitles_data
                $persistentStore.write(JSON.stringify(settings))
            }

            if (service == "Disney" && subtitles_data_link.match(/.+-MAIN.+/) && data.match(/,\nseg.+\.vtt/g)) {
                subtitles_data = data.match(/,\nseg.+\.vtt/g)
                let url_path = subtitles_data_link.match(/\/r\/(.+)/)[1].replace(/\w+\.m3u8/, "")
                settings[service].t_subtitles_url = subtitles_data.join("\n").replace(/,\n/g, host + url_path)
                $persistentStore.write(JSON.stringify(settings))
            }

            $done({})
        })

    }

    if (!body.match(patt)) $done({})
}

if (url.match(/\.(web)?vtt/) || service == "Netflix" || service == "General") {
    if (service != "Netflix" && url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) $done({ body: setting.subtitles })

    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") $done({})
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)
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
