// ==UserScript==
// @name         Prime Video Dualsub
// @description  Google翻译 + 中文在上，英文在下，内置设置，无需快捷指令
// @version      1.0
// @author       linshaohu
// @match        *://*.cloudfront.net/*
// @match        *://*.akamaihd.net/*
// @match        *://*.avi-cdn.net/*
// @match        *://*.pv-cdn.net/*
// ==/UserScript==

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    PrimeVideo: {
        type: "Google",
        lang: "English [CC]",
        sl: "auto",
        tl: "zh-CN",
        line: "f",  // 中文在上，英文在下
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
};

let settings = default_settings;
let service = "PrimeVideo";
let setting = settings[service];

if (url.match(/\.m3u8/)) $done({});

if (setting.type === "Disable") $done({});

let body = $response.body;
if (!body) $done({});

if (url.match(/\.vtt/)) {
    body = body.replace(/\r/g, "");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
    if (!dialogue) $done({});

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);
    let s_sentences = [];
    for (var i in dialogue) {
        s_sentences.push("~" + i + "~" + dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, ""));
    }

    s_sentences = groupAgain(s_sentences, 80);

    (async () => {
        let t_sentences = [];
        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}`,
                headers: { "User-Agent": "GoogleTranslate/6.29 (iOS)" },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            };

            let trans = await send_request(options, "post");
            if (trans.sentences) {
                for (var k in trans.sentences) {
                    if (trans.sentences[k].trans)
                        t_sentences.push(trans.sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " "));
                }
            }
        }

        let g_t_sentences = t_sentences.join(" ").match(/~\d+~[^~]+/g);
        if (!g_t_sentences) $done({ body });

        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`);
            let patt2 = new RegExp(`~${j}~\\s*(.+)`);
            if (g_t_sentences[j]) body = body.replace(patt, `$1\n${g_t_sentences[j].replace(`~${j}~`, "")}`);
        }

        $done({ body });
    })();
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method === "get") {
            $httpClient.get(options, function (err, resp, data) {
                if (err) reject(err); else resolve(data);
            });
        }
        if (method === "post") {
            $httpClient.post(options, function (err, resp, data) {
                if (err) reject(err); else resolve(JSON.parse(data));
            });
        }
    });
}

function groupAgain(data, num) {
    let result = [];
    for (let i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
