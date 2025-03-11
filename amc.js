/*
    Dualsub for Surge by Neurogram (Modified to remove Shortcuts dependency)
 
        - Disney+, Star+, HBO Max, Prime Video, YouTube, AMC official bilingual subtitles
        - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, AMC machine translation bilingual subtitles (Google, DeepL)
        - Customized language support
*/

// Surge 配置（参考用，需手动添加到Surge配置文件）
/*
[Script]
AMC-Dualsub = type=http-response,pattern=https:\/\/house-fastly-signed-us-east-1-prod.brightcovecdn.com\/composite-media\/v1\/hls\/v5\/clear\/.*\.vtt,requires-body=1,max-size=0,timeout=30,script-path=Dualsub.js

[MITM]
hostname = house-fastly-signed-us-east-1-prod.brightcovecdn.com
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Disney: {
        type: "Official",
        lang: "English [CC]",
        sl: "auto",
        tl: "English [CC]",
        line: "f",
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
        type: "Official",
        lang: "English CC",
        sl: "auto",
        tl: "en-US SDH",
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
        lang: "English",
        sl: "auto",
        tl: "zh-CN",
        line: "f",
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
    Paramount: {
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
    PrimeVideo: {
        type: "Official",
        lang: "English [CC]",
        sl: "auto",
        tl: "English [CC]",
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
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "sl"
    },
    AMC: {  // 新增AMC服务
        type: "Google",  // 默认使用Google翻译
        lang: "English",
        sl: "auto",
        tl: "zh-CN",  // 翻译成中文
        line: "s",  // 原文在上，翻译在下
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

// 初始化 settings，直接使用 default_settings，无需快捷方式
let settings = $persistentStore.read() ? JSON.parse($persistentStore.read()) : default_settings;

let service = "";
if (url.match(/(dss|star)ott.com/)) service = "Disney";
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax";
if (url.match(/huluim.com/)) service = "Hulu";
if (url.match(/nflxvideo.net/)) service = "Netflix";
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount";
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo";
if (url.match(/youtube.com/)) service = "YouTube";
if (url.match(/house-fastly-signed-us-east-1-prod.brightcovecdn.com/)) service = "AMC";  // 添加AMC域名匹配

if (!service) $done({});

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 移除 action=get 和 action=set 的快捷方式依赖逻辑
// 如果仍需动态调整，可手动修改 default_settings 中的 AMC 配置

if (setting.type == "Disable") $done({});

if (setting.type != "Official" && url.match(/\.m3u8/)) $done({});

let body = $response.body;
if (!body) $done({});

if (service == "YouTube") {
    let patt = new RegExp(`lang=${setting.tl}`);
    if (url.replace(/&lang=zh(-Hans)*&/, "&lang=zh-CN&").replace(/&lang=zh-Hant&/, "&lang=zh-TW&").match(patt) || url.match(/&tlang=/)) $done({});
    let t_url = `${url}&tlang=${setting.tl == "zh-CN" ? "zh-Hans" : setting.tl == "zh-TW" ? "zh-Hant" : setting.tl}`;
    let options = { url: t_url, headers: headers };
    $httpClient.get(options, function (error, response, data) {
        if (setting.line == "sl") $done({ body: data });
        let timeline = body.match(/<p t="\d+" d="\d+">/g);
        if (url.match(/&kind=asr/)) {
            body = body.replace(/<\/?s[^>]*>/g, "");
            data = data.replace(/<\/?s[^>]*>/g, "");
            timeline = body.match(/<p t="\d+" d="\d+"[^>]+>/g);
        }
        for (var i in timeline) {
            let patt = new RegExp(`${timeline[i]}([^<]+)<\\/p>`);
            if (body.match(patt) && data.match(patt)) {
                if (setting.line == "s") body = body.replace(patt, `${timeline[i]}$1\n${data.match(patt)[1]}</p>`);
                if (setting.line == "f") body = body.replace(patt, `${timeline[i]}${data.match(patt)[1]}\n$1</p>`);
            }
        }
        $done({ body });
    });
} else if (url.match(/\.(web)?vtt/)) {  // 处理 .vtt 文件，包括AMC
    if (setting.type == "Google") machine_subtitles("Google");
    if (setting.type == "DeepL") machine_subtitles("DeepL");
    if (setting.type == "External") external_subtitles();
}

function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`);
    if (!setting.external_subtitles.match(patt) || !body.match(patt)) $done({});
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
    body = body.replace(patt, external.match(patt)[0]);
    $done({ body });
}

async function machine_subtitles(type) {
    body = body.replace(/\r/g, "").replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2");
    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g);
    if (!dialogue) $done({});
    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g);
    let s_sentences = [];
    for (var i in dialogue) {
        s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`);
    }
    s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50);
    let t_sentences = [];
    let trans_result = [];

    if (type == "Google") {
        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                headers: { "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)" },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            };
            let trans = await send_request(options, "post");
            if (trans.sentences) {
                let sentences = trans.sentences;
                for (var k in sentences) {
                    if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"));
                }
            }
        }
        if (trans_result.length > 0) t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
    }

    if (type == "DeepL") {
        for (var l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            };
            let trans = await send_request(options, "post");
            if (trans.translations) trans_result.push(trans.translations);
        }
        if (trans_result.length > 0) {
            for (var o in trans_result) {
                for (var u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "));
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n");
        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`);
            if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`);
            let patt2 = new RegExp(`~${j}~\\s*(.+)`);
            if (g_t_sentences.match(patt2) && type == "Google") body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`);
            if (type == "DeepL") body = body.replace(patt, `$1\n${t_sentences[j]}`);
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

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject('Error');
                resolve(data);
            });
        }
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
