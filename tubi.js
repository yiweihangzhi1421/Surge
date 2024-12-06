let isTVOS = /tvOS/.test(navigator.userAgent);
let isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

// 使用适合的存储方式
let store = ($persistentStore || $prefs);
let settings = store.read() || default_settings;

let service = "";
if (url.match(/\.adrise\.tv/)) service = "Tubi";

if (!service) {
    $done({});
}

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 处理action请求
if (url.match(/action=get/)) {
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body);
    if (new_setting.type != "External") settings[service].external_subtitles = "null";
    if (new_setting.type == "Reset") new_setting = default_settings[service];
    Object.assign(settings[service], new_setting);
    store.write(JSON.stringify(settings));
    delete settings[service].t_subtitles_url;
    delete settings[service].subtitles;
    delete settings[service].external_subtitles;
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 字幕处理
if (url.match(/\.vtt/)) {
    if (url == setting.s_subtitles_url && setting.subtitles !== "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) {
        $done({ body: setting.subtitles });
    }

    if (setting.type == "Google") {
        machine_subtitles("Google");
    }
}

// 机器翻译字幕处理函数
async function machine_subtitles(type) {
    let body = $response.body;
    body = body.replace(/\r/g, "");
    let dialogue = body.match(/\d+:\d\d\.\d\d\d --> \d+:\d\d\.\d\d\d\n.+/g);
    if (!dialogue) {
        $done({});
    }

    let s_sentences = dialogue.map((item, index) => `~${index}~${item.replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d\.\d\d\d --> \d+:\d\d\.\d\d\d\n/, "")}`);
    s_sentences = groupAgain(s_sentences, 80);

    let trans_result = [];
    for (let sentences of s_sentences) {
        let options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
            headers: { "User-Agent": isTVOS ? "tvOS-Translate/1.0" : "iOS-Translate/1.0" },
            body: `q=${encodeURIComponent(sentences.join("\n"))}`
        };
        let trans = await send_request(options, "post");
        if (trans.sentences) {
            trans.sentences.forEach(item => {
                if (item.trans) trans_result.push(item.trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
            });
        }
    }

    if (trans_result.length > 0) {
        let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
        if (t_sentences.length > 0) {
            let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");
            dialogue.forEach((item, index) => {
                let patt2 = new RegExp(`~${index}~\\s*(.+)`);
                if (g_t_sentences.match(patt2)) {
                    body = body.replace(item, `${item}\n${g_t_sentences.match(patt2)[1]}`);
                }
            });
        }
    }

    settings[service].s_subtitles_url = url;
    settings[service].subtitles = body;
    settings[service].subtitles_type = setting.type;
    settings[service].subtitles_sl = setting.sl;
    settings[service].subtitles_tl = setting.tl;
    settings[service].subtitles_line = setting.line;
    store.write(JSON.stringify(settings));

    $done({ body });
}

// 发送请求函数
function send_request(options, method) {
    return new Promise((resolve, reject) => {
        try {
            if (method == "get") {
                $httpClient.get(options, function (error, response, data) {
                    if (error) {
                        reject(`GET Error: ${error}`);
                    } else {
                        resolve(data);
                    }
                });
            } else if (method == "post") {
                $httpClient.post(options, function (error, response, data) {
                    if (error) {
                        reject(`POST Error: ${error}`);
                    } else {
                        resolve(JSON.parse(data));
                    }
                });
            }
        } catch (err) {
            reject(`Request Failed: ${err}`);
        }
    });
}

// 字幕分组函数
function groupAgain(data, num) {
    let result = [];
    for (let i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
