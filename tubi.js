/*
Tubi Dualsub
Made by Neurogram

Support: adrise.tv subtitles
[Script]
Tubi-Dualsub = type=http-response,pattern=^http.+\.(adrise)\.tv\/.+\.vtt$,requires-body=1,max-size=0,timeout=30,script-path=Tubi-Dualsub.js
Tubi-Setting = type=http-request,pattern=^http.+setting.adrise.tv/\?action=(g|s)et,requires-body=1,max-size=0,script-path=Tubi-Dualsub.js

[MITM]
hostname = *.adrise.tv
*/

const url = $request.url;
const headers = $request.headers;

// 默认设置
const default_settings = {
    type: "Google",    // Google, DeepL, Disable
    sl: "auto",        // 源语言
    tl: "zh",         // 目标语言
    line: "s",        // s: 原文在上, f: 译文在上
    s_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null"
};

// 读取存储的设置
let settings = $persistentStore.read('tubi_dualsub_settings');
settings = settings ? { ...default_settings, ...JSON.parse(settings) } : default_settings;

// 处理设置请求
if (url.match(/action=get/)) {
    $done({ response: { body: JSON.stringify(settings), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body);
    if (new_setting.type) settings.type = new_setting.type;
    if (new_setting.sl) settings.sl = new_setting.sl;
    if (new_setting.tl) settings.tl = new_setting.tl;
    if (new_setting.line) settings.line = new_setting.line;
    $persistentStore.write(JSON.stringify(settings));
    $done({ response: { body: JSON.stringify(settings), headers: { "Content-Type": "application/json" } } });
}

// 主要字幕处理
if (settings.type == "Disable" || !url.match(/\.vtt/)) {
    $done({});
}

let body = $response.body;
if (!body) $done({});

async function machine_subtitles() {
    // 预处理字幕
    body = body.replace(/\r/g, "");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");

    // 提取对话
    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
    if (!dialogue) $done({});

    // 提取时间轴
    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);

    // 准备翻译句子
    let s_sentences = [];
    for (var i in dialogue) {
        s_sentences.push(`~${i}~${dialogue[i]
            .replace(/<\/*(c\.[^>]+|i|c)>/g, "")
            .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`);
    }

    // 分组处理
    let s_sentences_group = groupAgain(s_sentences, 80);
    let trans_result = [];

    // 翻译处理
    for (var p in s_sentences_group) {
        let options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
            },
            body: `q=${encodeURIComponent(s_sentences_group[p].join("\n"))}`
        };

        let trans = await send_request(options, "post");

        if (trans.sentences) {
            let sentences = trans.sentences;
            for (var k in sentences) {
                if (sentences[k].trans) {
                    trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
                }
            }
        }
        
        // 延迟以防请求过快
        await new Promise(r => setTimeout(r, 300));
    }

    // 合并结果
    if (trans_result.length > 0) {
        let g_t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);

        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`);
            if (settings.line == "s") {
                patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`);
            }

            let patt2 = new RegExp(`~${j}~\\s*(.+)`);

            if (g_t_sentences && g_t_sentences.match(patt2)) {
                body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
            }
        }
    }

    // 保存翻译结果
    settings.s_subtitles_url = url;
    settings.subtitles = body;
    settings.subtitles_type = settings.type;
    settings.subtitles_sl = settings.sl;
    settings.subtitles_tl = settings.tl;
    settings.subtitles_line = settings.line;
    $persistentStore.write(JSON.stringify(settings));

    $done({ body });
}

// 辅助函数
function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject('Error');
                resolve(JSON.parse(data));
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

// 启动翻译
if (settings.type == "Google") {
    machine_subtitles();
}
