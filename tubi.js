let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Tubi: {
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
if (typeof settings == "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/\.adrise\.tv/)) service = "Tubi";

if (!service) {
    console.log("Service not recognized, exiting.");
    $done({});
}

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 处理 `action=get` 和 `action=set` 请求
if (url.match(/action=get/)) {
    console.log("Handling action=get request.");
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
    console.log("Handling action=set request.");
    let new_setting = JSON.parse($request.body);
    if (new_setting.type != "External") settings[service].external_subtitles = "null";
    if (new_setting.type == "Reset") new_setting = default_settings[service];
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
    if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.subtitles_tl;
    if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line;
    if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "");
    $persistentStore.write(JSON.stringify(settings));
    delete settings[service].t_subtitles_url;
    delete settings[service].subtitles;
    delete settings[service].external_subtitles;
    console.log("Settings updated: " + JSON.stringify(settings[service]));
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 处理 .vtt 字幕
if (url.match(/\.vtt/)) {
    console.log("Handling .vtt subtitles request.");
    if (url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) {
        console.log("Returning cached subtitles.");
        $done({ body: setting.subtitles });
    }

    if (setting.type == "Google") {
        console.log("Using Google to translate subtitles.");
        machine_subtitles("Google");
    }
}

// 机器翻译字幕处理函数
async function machine_subtitles(type) {
    console.log("Machine translating subtitles using: " + type);
    let body = $response.body;
    body = body.replace(/\r/g, "");
    console.log("Original subtitles body: \n" + body);
    let dialogue = body.match(/\d+:\d\d\.\d\d\d --> \d+:\d\d\.\d\d\d\n.+/g);
    if (!dialogue) {
        console.log("No dialogue found in subtitles.");
        $done({});
    }

    let s_sentences = [];
    for (let i in dialogue) {
        s_sentences.push(`~${i}~${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d\.\d\d\d --> \d+:\d\d\.\d\d\d\n/, "")}`);
    }
    s_sentences = groupAgain(s_sentences, 80);

    let t_sentences = [];
    let trans_result = [];

    // Google 翻译处理
    for (let p in s_sentences) {
        console.log("Translating batch: " + p);
        let options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
            headers: { "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)" },
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

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");

        for (let j in dialogue) {
            let patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`);
            let patt2 = new RegExp(`~${j}~\s*(.+)`);

            if (g_t_sentences.match(patt2)) {
                body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
            }
        }

        settings[service].s_subtitles_url = url;
        settings[service].subtitles = body;
        settings[service].subtitles_type = setting.type;
        settings[service].subtitles_sl = setting.sl;
        settings[service].subtitles_tl = setting.tl;
        settings[service].subtitles_line = setting.line;
        $persistentStore.write(JSON.stringify(settings));
        console.log("Subtitles translated and cached.");
    }

    $done({ body });
}

// 发送请求函数
function send_request(options, method) {
    return new Promise((resolve, reject) => {
        console.log("Sending request: " + options.url);
        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) {
                    console.log("Request error: " + error);
                    return reject('Error');
                }
                resolve(data);
            });
        }

        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) {
                    console.log("Request error: " + error);
                    return reject('Error');
                }
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
