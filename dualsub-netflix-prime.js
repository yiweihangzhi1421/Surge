/*
    Dualsub for Loon by Neurogram (adapted by Gemini)

        - Disney+, Star+, HBO Max, Prime Video, YouTube official bilingual subtitles
        - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. external subtitles
        - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. machine translation bilingual subtitles (Google, DeepL)
        - Customized language support

    Original Manual for Quantumult X:
        Setting tool for Shortcuts: https://www.icloud.com/shortcuts/8ec4a2a3af514282bf27a11050f39fc2

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

// Loon 适配：获取请求和响应对象
let url = $request.url;
let headers = $request.headers;
let method = $request.method; // 获取请求方法
let body = $response.body; // 响应体

// Loon 适配：统一的结束函数
function loonDone(obj) {
    if (obj.body !== undefined) {
        $done({body: obj.body});
    } else {
        $done({});
    }
}

let default_settings = {
    Disney: {
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English [CC]",
        sl: "auto",
        tl: "English [CC]",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English CC",
        sl: "auto",
        tl: "en-US SDH",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
        type: "Google", // 强制使用Google翻译，因为官方字幕无法控制上下顺序，而Google翻译可以通过line参数控制
        lang: "中文 [CC]", // 这个通常是官方字幕的语言，这里先写上中文
        sl: "auto", // 源语言自动检测
        tl: "zh-Hans", // 目标语言设置为简体中文 (Google 翻译通常用 zh-Hans 表示简体中文)
        line: "f", // f 表示翻译后的语言（即中文）在上面，s 表示源语言在上面
        dkey: "null", // DeepL API key (这里我们使用Google翻译，所以此项不重要)
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
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
        type: "Enable", // Enable, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "sl"
    }
}

// Loon 适配：使用 $persistentStore.read 和 $persistentStore.write 替代 $prefs
let settings = JSON.parse($persistentStore.read("dualsub_settings") || JSON.stringify(default_settings));

let service = ""
if (url.match(/(dss|star)ott.com/)) service = "Disney"
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax"
if (url.match(/huluim.com/)) service = "Hulu"
if (url.match(/nflxvideo.net/)) service = "Netflix"
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount"
if (url.match(/(cloudfront|akamaihd|avi-cdn|pv-cdn).net/)) service = "PrimeVideo" // 添加 pv-cdn
if (url.match(/general.media/)) service = "General"
if (url.match(/youtube.com/)) service = "YouTube" // 修正 YouTube URL

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

if (!service) loonDone({})

if (!settings[service]) settings[service] = default_settings[service]
let setting = settings[service]

// 适配 Loon：设置/获取请求处理
if (url.match(/action=get/)) {
    delete setting.t_subtitles_url
    delete setting.subtitles
    delete setting.external_subtitles
    // Loon 适配：直接返回 body，状态码和 headers 由 Loon 自动处理
    loonDone({ body: JSON.stringify(setting) })
}

if (url.match(/action=set/)) {
    // Loon 适配：$request.body 在 Loon 中直接是字符串
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
    if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.tl
    if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line
    if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "")
    // Loon 适配：使用 $persistentStore.write 存储设置
    $persistentStore.write(JSON.stringify(settings), "dualsub_settings")
    delete settings[service].t_subtitles_url
    delete settings[service].subtitles
    delete settings[service].external_subtitles
    loonDone({ body: JSON.stringify(settings[service]) })
}

if (service == "Netflix" && !body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+\n.+/g)) loonDone({})

if (setting.type == "Disable") loonDone({})

if (setting.type != "Official" && url.match(/\.m3u8/)) loonDone({})

if (service == "YouTube") {

    let patt = new RegExp(`lang=${setting.tl}`)

    if (url.replace(/&lang=zh(-Hans)*&/, "&lang=zh-CN&").replace(/&lang=zh-Hant&/, "&lang=zh-TW&").match(patt) || url.match(/&tlang=/)) loonDone({})

    let t_url = `${url}&tlang=${setting.tl == "zh-CN" ? "zh-Hans" : setting.tl == "zh-TW" ? "zh-Hant" : setting.tl}`

    let options = {
        url: t_url,
        headers: headers
    }

    $httpClient.get(options, (error, response, data) => {
        if (error) {
            console.log("YouTube fetch error:", error);
            loonDone({});
            return;
        }

        if (setting.line == "sl") {
            loonDone({ body: data });
            return;
        }

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

        loonDone({ body });
    });
    return;
}

let subtitles_urls_data = setting.t_subtitles_url

if (setting.type == "Official" && url.match(/\.m3u8/)) {
    settings[service].t_subtitles_url = "null"
    $persistentStore.write(JSON.stringify(settings), "dualsub_settings")

    let patt = new RegExp(`TYPE=SUBTITLES.+NAME="${setting.tl.replace(/(\[|\]|\(|\))/g, "\\$1")}.+URI="([^"]+)`)

    if (body.match(patt)) {

        let host = ""
        if (service == "Disney") host = url.match(/https.+media.(dss|star)ott.com\/ps01\/disney\/[^\/]+\//)[0]

        let subtitles_data_link = `${host}${body.match(patt)[1]}`

        if (service == "PrimeVideo") {
            correct_host = subtitles_data_link.match(/https:\/\/(.+(cloudfront|akamaihd|avi-cdn|pv-cdn).net)/)[1]
            headers.Host = correct_host
        }

        let options = {
            url: subtitles_data_link,
            method: "GET",
            headers: headers
        }

        $httpClient.get(options, (error, response, data) => {
            if (error) {
                console.log("Official subtitles fetch error:", error);
                loonDone({});
                return;
            }
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
                $persistentStore.write(JSON.stringify(settings), "dualsub_settings")
            }

            if (service == "Disney" && subtitles_data_link.match(/.+-MAIN.+/) && data.match(/,\nseg.+\.vtt/g)) {
                subtitles_data = data.match(/,\nseg.+\.vtt/g)
                let url_path = subtitles_data_link.match(/\/r\/(.+)/)[1].replace(/\w+\.m3u8/, "")
                settings[service].t_subtitles_url = subtitles_data.join("\n").replace(/,\n/g, host + url_path)
                $persistentStore.write(JSON.stringify(settings), "dualsub_settings")
            }

            loonDone({});
        });
        return;
    }

    if (!body.match(patt)) loonDone({});
}

if (url.match(/\.(web)?vtt/) || service == "Netflix" || service == "General") {
    if (service != "Netflix" && url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) {
        loonDone({ body: setting.subtitles });
        return;
    }

    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") {
            loonDone({});
            return;
        }
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")

    if (setting.type == "DeepL") machine_subtitles("DeepL")

    if (setting.type == "External") external_subtitles()
}

function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\d.\\d.+(\\n|.)+`)
    if (!setting.external_subtitles.match(patt)) loonDone({})
    if (!body.match(patt)) loonDone({})
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
    body = body.replace(patt, external.match(patt)[0])
    loonDone({ body: body })
}

async function machine_subtitles(type) {

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)

    if (!dialogue) {
        loonDone({});
        return;
    }

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    let s_sentences = []
    for (var i in dialogue) {
        s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
    }
    s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50)

    let t_sentences = []
    let trans_result = []

    if (type == "Google") {
        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                method: "POST",
                headers: {
                    "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
                },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            }

            try {
                const response = await new Promise((resolve, reject) => {
                    $httpClient.post(options, (error, res, data) => {
                        if (error) reject(error);
                        else resolve(JSON.parse(data));
                    });
                });
                if (response.sentences) {
                    let sentences = response.sentences
                    for (var k in sentences) {
                        if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
                    }
                }
            } catch (e) {
                console.log("Google translate request error:", e);
            }
        }

        if (trans_result.length > 0) {
            t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
        }

    }

    if (type == "DeepL") {
        for (var l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            }

            try {
                const response = await new Promise((resolve, reject) => {
                    $httpClient.post(options, (error, res, data) => {
                        if (error) reject(error);
                        else resolve(JSON.parse(data));
                    });
                });
                if (response.translations) trans_result.push(response.translations)
            } catch (e) {
                console.log("DeepL translate request error:", e);
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
            $persistentStore.write(JSON.stringify(settings), "dualsub_settings")
        }
    }

    loonDone({ body: body })

}

async function official_subtitles(subtitles_urls_data) {
    let result = []

    if (service == "Disney" || service == "HBOMax") {
        let subtitles_index = parseInt(url.match(/(\d+)\.vtt/)[1])

        let start = subtitles_index - 3 < 0 ? 0 : subtitles_index - 3

        subtitles_urls_data = subtitles_urls_data.slice(start, subtitles_index + 4)
    }

    for (var k in subtitles_urls_data) {
        let options = {
            url: subtitles_urls_data[k],
            method: "GET",
            headers: headers
        }
        result.push(await send_request_loon(options))
    }

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    for (var i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]})`)
        if (setting.line == "s") patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`)

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0]

        let patt2 = new RegExp(`${time}.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n.+)+`)

        let dialogue = result.join("\n\n").match(patt2)

        if (dialogue) body = body.replace(
            patt1,
            `$1\n${dialogue[0]
                .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")
                .replace(/\n/, " ")}`
        )
    }

    settings[service].s_subtitles_url = url
    settings[service].subtitles = body
    settings[service].subtitles_type = setting.type
    settings[service].subtitles_sl = setting.sl
    settings[service].subtitles_tl = setting.tl
    settings[service].subtitles_line = setting.line
    $persistentStore.write(JSON.stringify(settings), "dualsub_settings")

    loonDone({ body: body })
}

function send_request_loon(options) {
    return new Promise((resolve, reject) => {
        $httpClient.get(options, (error, response, data) => {
            if (error) {
                console.log("send_request_loon error:", error);
                reject(error);
            } else {
                resolve(options.method == "GET" ? data : JSON.parse(data));
            }
        });
    });
}

function groupAgain(data, num) {
    var result = []
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num))
    }
    return result
}
