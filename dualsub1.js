/*
    Dualsub for iOS in Surge by Neurogram

    - Hulu, Mubi, Peacock official bilingual subtitles
    - Hulu, Mubi, Peacock external subtitles
    - Hulu, Mubi, Peacock machine translation bilingual subtitles (Google, DeepL)
    - Customized language support for iOS

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Hulu: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "zh", // 改成中文
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
    Mubi: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "zh", // 改成中文
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
    Peacock: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "zh", // 改成中文
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
    }
};

// 读取和处理设置
let settings = $persistentStore.read();
if (!settings) settings = default_settings;
if (typeof settings === "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/huluim.com/)) service = "Hulu";
if (url.match(/https:\/\/.+mubicdn.net\/.+\.webvtt/)) service = "Mubi";
if (url.match(/https:\/\/.+peacocktv.com\/.+\.webvtt/)) service = "Peacock";

if (!service) $done({});

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 处理 `action=get` 和 `action=set` 请求
if (url.match(/action=get/)) {
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body);
    if (new_setting.type !== "External") settings[service].external_subtitles = "null";
    if (new_setting.type === "Reset") new_setting = default_settings[service];
    if (new_setting.type) settings[service].type = new_setting.type;
    if (new_setting.lang) settings[service].lang = new_setting.lang;
    if (new_setting.sl) settings[service].sl = new_setting.sl;
    if (new_setting.tl) settings[service].tl = new_setting.tl;
    if (new_setting.line) settings[service].line = new_setting.line;
    if (new_setting.dkey) settings[service].dkey = new_setting.dkey;
    if (new_setting.s_subtitles_url) settings[service].s_subtitles_url = new_setting.s_subtitles_url;
    if (new_setting.t_subtitles_url) settings[service].t_subtitles_url = new_setting.t_subtitles_url;
    if (new_setting.subtitles) settings[service].subtitles = new_setting.subtitles;
    if (new_setting.subtitles_type) settings[service].subtitles_type = new_setting.subtitles_type;
    if (new_setting.subtitles_sl) settings[service].subtitles_sl = new_setting.subtitles_sl;
    if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.tl;
    if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line;
    if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "");
    $persistentStore.write(JSON.stringify(settings));
    delete settings[service].t_subtitles_url;
    delete settings[service].subtitles;
    delete settings[service].external_subtitles;
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 处理不同的字幕逻辑
if (setting.type === "Disable") $done({});
if (setting.type !== "Official" && url.match(/\.m3u8/)) $done({});

let body = $response.body;
if (!body) $done({});

// Hulu 特殊处理逻辑
if (service === "Hulu" && url.match(/\.vtt$/)) {
    // 检查并强制解析 Content-Type
    let contentType = $response.headers['Content-Type'];
    if (contentType === 'application/octet-stream') {
        // 强制将其解析为 WebVTT 字幕
        $response.headers['Content-Type'] = 'text/vtt';
    }
    body = handleHuluSubtitles(body);
    $done({ body });
}

// 处理 .vtt 字幕
if (url.match(/\.(web)?vtt/)) {
    if (url === setting.s_subtitles_url && setting.subtitles !== "null" && setting.subtitles_type === setting.type && setting.subtitles_sl === setting.sl && setting.subtitles_tl === setting.tl && setting.subtitles_line === setting.line) {
        $done({ body: setting.subtitles });
    }

    if (setting.type === "Google") machine_subtitles("Google");
    if (setting.type === "DeepL") machine_subtitles("DeepL");
    if (setting.type === "External") external_subtitles();
}

// Hulu 字幕特殊处理函数
function handleHuluSubtitles(body) {
    // 简化处理逻辑，确保格式正确
    body = body.replace(/\r/g, ""); // 去除回车符
    let dialogue = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d\n.+/g);
    if (dialogue) {
        // 添加简单的中英文合并逻辑
        body = dialogue.map(line => {
            let [time, text] = line.split("\n");
            let translatedText = translateText(text); // 使用机器翻译或其他方式翻译文本
            return `${time}\n${text}\n${translatedText}`;
        }).join("\n\n");
    }
    return body;
}

// 简单的翻译文本函数（可替换为实际翻译逻辑）
function translateText(text) {
    // 这里可以调用 Google 或 DeepL 翻译 API
    return `【翻译】${text}`; // 示例翻译文本
}

// 外部字幕处理函数
function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`);
    if (!setting.external_subtitles.match(patt)) $done({});
    if (!body.match(patt)) $done({});
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
    body = body.replace(patt, external.match(patt)[0]);
    $done({ body });
}

// 机器翻译字幕处理函数
async function machine_subtitles(type) {
    body = body.replace(/\r/g, "");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
    if (!dialogue) $done({});

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);
    let s_sentences = [];
    for (let i in dialogue) {
        s_sentences.push(`${type === "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`);
    }
    s_sentences = groupAgain(s_sentences, type === "Google" ? 80 : 50);

    let t_sentences = [];
    let trans_result = [];

    // Google 翻译处理
    if (type === "Google") {
        for (let p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            };
            let trans = await send_request(options, "post");
            if (trans.sentences) {
                let sentences = trans.sentences;
                for (let k in sentences) {
                    if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
                }
            }
        }
        if (trans_result.length > 0) {
            t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
        }
    }

    // DeepL 翻译处理
    if (type === "DeepL") {
        for (let l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                body: `auth_key=${setting.dkey}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            };
            let trans = await send_request(options, "post");
            if (trans.translations) trans_result.push(trans.translations);
        }
        if (trans_result.length > 0) {
            for (let o in trans_result) {
                for (let u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "));
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");

        for (let j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`);
            let patt2 = new RegExp(`~${j}~\\s*(.+)`);
            if (g_t_sentences.match(patt2) && type === "Google") {
                body = body.replace(patt, `$1\n${dialogue[j].replace(/<\/*(c\.[^>]+|i|c)>/g, "")}\n${g_t_sentences.match(patt2)[1]}`);
            }
            if (type === "DeepL") {
                body = body.replace(patt, `$1\n${dialogue[j].replace(/<\/*(c\.[^>]+|i|c)>/g, "")}\n${t_sentences[j]}`);
            }
        }

        settings[service].s_subtitles_url = url;
        settings[service].subtitles = body;
        settings[service].subtitles_type = setting.type;
        settings[service].subtitles_sl = setting.sl;
        settings[service].subtitles_tl = setting.tl;
        settings[service].subtitles_line = setting.line;
        $persistentStore.write(JSON.stringify(settings));
    }

    $done({ body });
}

// 发送请求函数
function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method === "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject("Error");
                resolve(data);
            });
        }
        if (method === "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject("Error");
                resolve(JSON.parse(data));
            });
        }
    });
}

// 分组函数
function groupAgain(data, num) {
    let result = [];
    for (let i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
