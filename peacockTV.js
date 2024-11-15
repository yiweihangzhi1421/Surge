/*
    Dualsub for Peacock iOS - Optimized Version
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
    }
}

// 初始化设置
console.log("[Peacock] Initializing script")
console.log("[Peacock] Processing URL:", url)

let settings = $persistentStore.read()

if (!settings) {
    console.log("[Peacock] No settings found, using defaults")
    settings = default_settings
}

if (typeof (settings) == "string") {
    try {
        settings = JSON.parse(settings)
        console.log("[Peacock] Successfully loaded settings")
    } catch (e) {
        console.log("[Peacock] Error parsing settings:", e)
        settings = default_settings
    }
}

// 服务检测
let service = ""
if (url.match(/peacocktv\.com/)) {
    service = "Peacock"
    console.log("[Peacock] Service detected: Peacock")
}

if (!service) {
    console.log("[Peacock] No supported service detected")
    $done({})
}

if (!settings[service]) {
    console.log("[Peacock] No service settings found, using defaults")
    settings[service] = default_settings[service]
}
let setting = settings[service]

// 设置请求处理
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
    if (new_setting.type) settings[service].type = new_setting.type
    if (new_setting.lang) settings[service].lang = new_setting.lang
    if (new_setting.sl) settings[service].sl = new_setting.sl
    if (new_setting.tl) settings[service].tl = new_setting.tl
    if (new_setting.line) settings[service].line = new_setting.line
    if (new_setting.dkey) settings[service].dkey = new_setting.dkey
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

// 处理二进制响应
if ($response.headers['Content-Type'] === 'application/octet-stream') {
    try {
        body = new TextDecoder().decode(body);
        console.log("[Peacock] Successfully decoded binary response");
    } catch (e) {
        console.log("[Peacock] Error decoding binary response:", e);
        $done({});
    }
}

if (!body) {
    console.log("[Peacock] No response body found");
    $done({});
}

if (url.match(/\.(vtt|webvtt)/) || service == "Peacock") {
    console.log("[Peacock] Processing subtitle file");
    
    // 检查缓存
    if (url == setting.s_subtitles_url && 
        setting.subtitles != "null" && 
        setting.subtitles_type == setting.type && 
        setting.subtitles_sl == setting.sl && 
        setting.subtitles_tl == setting.tl && 
        setting.subtitles_line == setting.line) {
        console.log("[Peacock] Using cached subtitles");
        $done({ body: setting.subtitles });
    }

    if (setting.type == "Google") {
        console.log("[Peacock] Using Google Translate");
        machine_subtitles("Google");
    }
    
    if (setting.type == "DeepL") machine_subtitles("DeepL");
}
async function machine_subtitles(type) {
    console.log("[Peacock] Starting translation process");

    try {
        // 清理和标准化字幕文本
        body = body.replace(/\r/g, "");
        // 保留 X-TIMESTAMP-MAP
        let timestamp_map = body.match(/X-TIMESTAMP-MAP=.+/);
        body = body.replace(/WEBVTT\n.+\n/, "WEBVTT\n\n");

        let dialogue = body.match(/\d\d:\d\d:\d\d\.\d\d\d --> \d\d:\d\d:\d\d\.\d\d\d.+\n.+/g);

        if (!dialogue) {
            console.log("[Peacock] No dialogue found");
            $done({});
            return;
        }

        console.log("[Peacock] Found", dialogue.length, "subtitle entries");

        let timeline = body.match(/\d\d:\d\d:\d\d\.\d\d\d --> \d\d:\d\d:\d\d\.\d\d\d.+/g);

        let s_sentences = [];
        for (var i in dialogue) {
            // 处理方括号内的提示文本
            let text = dialogue[i].replace(/\d\d:\d\d:\d\d\.\d\d\d --> \d\d:\d\d:\d\d\.\d\d\d.+\n/, "")
                .replace(/<\/?[^>]+(>|$)/g, "") // 移除标签
                .replace(/\[.+?\]/g, "") // 移除方括号内容
                .replace(/\(.+?\)/g, "") // 移除圆括号内容
                .trim();
            
            // 只翻译非空且不是纯音效的文本
            if (text && !text.match(/^[\[\(].+[\]\)]$/)) {
                s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${text}`);
            }
        }
        
        s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50);
        console.log("[Peacock] Prepared", s_sentences.length, "translation batches");

        let t_sentences = [];
        let trans_result = [];

        if (type == "Google") {
            for (var p in s_sentences) {
                let options = {
                    url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                    headers: {
                        "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
                    },
                    body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
                };

                try {
                    let trans = await send_request(options, "post");
                    console.log("[Peacock] Translated batch", parseInt(p) + 1, "of", s_sentences.length);

                    if (trans.sentences) {
                        let sentences = trans.sentences;
                        for (var k in sentences) {
                            if (sentences[k].trans) {
                                trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
                            }
                        }
                    }
                } catch (error) {
                    console.log("[Peacock] Translation error:", error);
                    continue;
                }
            }

            if (trans_result.length > 0) {
                t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
                console.log("[Peacock] Completed translation");
            }
        }

        if (t_sentences.length > 0) {
            let new_body = "WEBVTT\n";
            if (timestamp_map) {
                new_body += timestamp_map[0] + "\n";
            }
            new_body += "\n";

            for (var j in dialogue) {
                let patt = new RegExp(`(${timeline[j]})`);
                if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`);

                let patt2 = new RegExp(`~${j}~\\s*(.+)`);

                let current_part = dialogue[j];
                if (g_t_sentences.match(patt2)) {
                    current_part = current_part.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
                }
                new_body += current_part + "\n\n";
            }

            body = new_body;

            if (service != "Netflix") {
                settings[service].s_subtitles_url = url;
                settings[service].subtitles = body;
                settings[service].subtitles_type = setting.type;
                settings[service].subtitles_sl = setting.sl;
                settings[service].subtitles_tl = setting.tl;
                settings[service].subtitles_line = setting.line;
                $persistentStore.write(JSON.stringify(settings));
                console.log("[Peacock] Cached translated subtitles");
            }
        }

        $done({ body });

    } catch (error) {
        console.log("[Peacock] Process error:", error);
        $done({});
    }
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) {
                    console.log("[Peacock] Request error:", error);
                    return reject('Error');
                }
                try {
                    let parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    console.log("[Peacock] Parse error:", e);
                    reject(e);
                }
            });
        }
    });
}

function groupAgain(data, num) {
    var result = [];
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
