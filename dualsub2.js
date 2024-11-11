/*
    Dualsub for tvOS in Surge by Neurogram

        - Disney+, HBO Max, Prime Video, YouTube official bilingual subtitles
        - Disney+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. external subtitles
        - Disney+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. machine translation bilingual subtitles (Google, DeepL)
        - Customized language support for tvOS

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Disney: {
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English [CC]",
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
    HBOMax: {
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English CC",
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
    Netflix: {
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
    Paramount: {
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
    PrimeVideo: {
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English [CC]",
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
    General: {
        service: "null",
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
    YouTube: {
        type: "Enable", // Enable, Disable
        lang: "English",
        sl: "auto",
        tl: "zh", // 改成中文
        line: "sl"
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
if (url.match(/(dss|star)ott.com/)) service = "Disney";
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax";
if (url.match(/huluim.com/)) service = "Hulu";
if (url.match(/nflxvideo.net/)) service = "Netflix";
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount";
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo";
if (url.match(/general.media/)) service = "General";
if (url.match(/youtube.com/)) service = "YouTube";
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
    if (new_setting.service && service === "General") settings[service].service = new_setting.service.replace(/\r/g, "");
    if (new_setting.type) settings[service].type = new_setting.type;
    if (new_setting.lang) settings[service].lang = new_setting.lang;
    if (new_setting.sl) settings[service].sl = new_setting.sl;
    if (new_setting.tl) settings[service].tl = new_setting.tl;
    if (new_setting.line) settings[service].line = new_setting.line;
    if (new_setting.dkey && service !== "YouTube") settings[service].dkey = new_setting.dkey;
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
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 处理不同的字幕逻辑
if (setting.type === "Disable") $done({});
if (setting.type !== "Official" && url.match(/\.m3u8/)) $done({});

let body = $response.body;
if (!body) $done({});

// 处理字幕逻辑...

// 处理机器翻译、外部字幕和官方字幕的逻辑函数...
// 剩余逻辑与原脚本一致
// 处理 YouTube 的字幕逻辑
if (service === "YouTube") {
    let patt = new RegExp(`lang=${setting.tl}`);

    if (url.replace(/&lang=zh(-Hans)*&/, "&lang=zh-CN&").replace(/&lang=zh-Hant&/, "&lang=zh-TW&").match(patt) || url.match(/&tlang=/)) $done({});

    let t_url = `${url}&tlang=${setting.tl === "zh-CN" ? "zh-Hans" : setting.tl === "zh-TW" ? "zh-Hant" : setting.tl}`;

    let options = {
        url: t_url,
        headers: headers
    };

    $httpClient.get(options, function (error, response, data) {
        if (setting.line === "sl") $done({ body: data });
        let timeline = body.match(/<p t="\d+" d="\d+">/g);

        if (url.match(/&kind=asr/)) {
            body = body.replace(/<\/?s[^>]*>/g, "");
            data = data.replace(/<\/?s[^>]*>/g, "");
            timeline = body.match(/<p t="\d+" d="\d+"[^>]+>/g);
        }

        for (let i in timeline) {
            let patt = new RegExp(`${timeline[i]}([^<]+)<\\/p>`);
            if (body.match(patt) && data.match(patt)) {
                if (setting.line === "s") body = body.replace(patt, `${timeline[i]}$1\n${data.match(patt)[1]}</p>`);
                if (setting.line === "f") body = body.replace(patt, `${timeline[i]}${data.match(patt)[1]}\n$1</p>`);
            }
        }

        $done({ body });
    });
}

// 处理各个平台的字幕请求和翻译逻辑
let subtitles_urls_data = setting.t_subtitles_url;

if (setting.type === "Official" && url.match(/\.m3u8/)) {
    settings[service].t_subtitles_url = "null";
    $persistentStore.write(JSON.stringify(settings));

    let patt = new RegExp(`TYPE=SUBTITLES.+NAME="${setting.tl.replace(/(\[|\]|\(|\))/g, "\\$1")}.+URI="([^"]+)`);

    if (body.match(patt)) {
        let host = "";
        if (service === "Disney") host = url.match(/https.+media.(dss|star)ott.com\/ps01\/disney\/[^\/]+\//)[0];

        let subtitles_data_link = `${host}${body.match(patt)[1]}`;

        if (service === "PrimeVideo") {
            let correct_host = subtitles_data_link.match(/https:\/\/(.+(cloudfront|akamaihd|avi-cdn).net)/)[1];
            headers.Host = correct_host;
        }

        let options = {
            url: subtitles_data_link,
            headers: headers
        };

        $httpClient.get(options, function (error, response, data) {
            let subtitles_data = "";
            if (service === "Disney") subtitles_data = data.match(/.+-MAIN.+\.vtt/g);
            if (service === "HBOMax") subtitles_data = data.match(/http.+\.vtt/g);
            if (service === "PrimeVideo") subtitles_data = data.match(/.+\.vtt/g);

            if (service === "Disney") host = host + "r/";
            if (service === "PrimeVideo") host = subtitles_data_link.match(/https.+\//)[0];

            if (subtitles_data) {
                subtitles_data = subtitles_data.join("\n");
                if (service === "Disney" || service === "PrimeVideo") subtitles_data = subtitles_data.replace(/(.+)/g, `${host}$1`);
                settings[service].t_subtitles_url = subtitles_data;
                $persistentStore.write(JSON.stringify(settings));
            }

            if (service === "Disney" && subtitles_data_link.match(/.+-MAIN.+/) && data.match(/,\nseg.+\.vtt/g)) {
                subtitles_data = data.match(/,\nseg.+\.vtt/g);
                let url_path = subtitles_data_link.match(/\/r\/(.+)/)[1].replace(/\w+\.m3u8/, "");
                settings[service].t_subtitles_url = subtitles_data.join("\n").replace(/,\n/g, host + url_path);
                $persistentStore.write(JSON.stringify(settings));
            }

            $done({});
        });
    }

    if (!body.match(patt)) $done({});
}

// 处理 .vtt 字幕
if (url.match(/\.(web)?vtt/) || service === "Netflix" || service === "General") {
    if (service !== "Netflix" && url === setting.s_subtitles_url && setting.subtitles !== "null" && setting.subtitles_type === setting.type && setting.subtitles_sl === setting.sl && setting.subtitles_tl === setting.tl && setting.subtitles_line === setting.line) {
        $done({ body: setting.subtitles });
    }

    if (setting.type === "Official") {
        if (subtitles_urls_data === "null") $done({});
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g);
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data);
    }

    if (setting.type === "Google") machine_subtitles("Google");
    if (setting.type === "DeepL") machine_subtitles("DeepL");
    if (setting.type === "External") external_subtitles();
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
            if (setting.line === "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`);

            let patt2 = new RegExp(`~${j}~\\s*(.+)`);

            if (g_t_sentences.match(patt2) && type === "Google") {
                body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
            }

            if (type === "DeepL") {
                body = body.replace(patt, `$1\n${t_sentences[j]}`);
            }
        }

        if (service !== "Netflix") {
            settings[service].s_subtitles_url = url;
            settings[service].subtitles = body;
            settings[service].subtitles_type = setting.type;
            settings[service].subtitles_sl = setting.sl;
            settings[service].subtitles_tl = setting.tl;
            settings[service].subtitles_line = setting.line;
            $persistentStore.write(JSON.stringify(settings));
        }
    }

    $done({ body });
}

// 官方字幕处理函数
async function official_subtitles(subtitles_urls_data) {
    let result = [];

    if (service === "Disney" || service === "HBOMax") {
        let subtitles_index = parseInt(url.match(/(\d+)\.vtt/)[1]);
        let start = subtitles_index - 3 < 0 ? 0 : subtitles_index - 3;
        subtitles_urls_data = subtitles_urls_data.slice(start, subtitles_index + 4);
    }

    for (let k in subtitles_urls_data) {
        let options = {
            url: subtitles_urls_data[k],
            headers: headers
        };
        result.push(await send_request(options, "get"));
    }

    body = body.replace(/\r/g, "");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);

    for (let i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]})`);
        if (setting.line === "s") patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`);

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0];
        let patt2 = new RegExp(`${time}.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n.+)+`);

        let dialogue = result.join("\n\n").match(patt2);

        if (dialogue) {
            body = body.replace(
                patt1,
                `$1\n${dialogue[0]
                    .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")
                    .replace(/\n/, " ")}`
            );
        }
    }

    settings[service].s_subtitles_url = url;
    settings[service].subtitles = body;
    settings[service].subtitles_type = setting.type;
    settings[service].subtitles_sl = setting.sl;
    settings[service].subtitles_tl = setting.tl;
    settings[service].subtitles_line = setting.line;
    $persistentStore.write(JSON.stringify(settings));

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
