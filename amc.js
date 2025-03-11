/*
    Dualsub for Surge by Neurogram (Optimized for AMC+ with signed URL and multi-line .vtt support)
 
        - Disney+, Star+, HBO Max, Prime Video, YouTube, AMC machine translation bilingual subtitles (Google, DeepL)
        - Customized language support
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    AMC: {
        type: "Google",
        lang: "English",
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
};

// 初始化 settings，直接使用 default_settings
let settings = $persistentStore.read() ? JSON.parse($persistentStore.read()) : default_settings;

let service = "";
if (url.match(/house-fastly-signed-us-east-1-prod.brightcovecdn.com/)) service = "AMC";

if (!service) $done({});

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

if (setting.type == "Disable") $done({});

let body = $response.body;
if (!body) {
    console.log(`[Dualsub] No response body for URL: ${url}`);
    $done({});
}

if (url.match(/\.vtt/)) {
    console.log(`[Dualsub] Processing .vtt file for ${service}: ${url}`);
    if (!body.includes("WEBVTT")) {
        console.log(`[Dualsub] Invalid .vtt content (no WEBVTT header): ${body.slice(0, 100)}`);
        $done({});
    }
    if (setting.type == "Google") machine_subtitles("Google");
    if (setting.type == "DeepL") machine_subtitles("DeepL");
    if (setting.type == "External") external_subtitles();
}

function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`);
    if (!setting.external_subtitles.match(patt) || !body.match(patt)) $done({});
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\\d\d),(\d\d\d)/g, "$1.$2");
    body = body.replace(patt, external.match(patt)[0]);
    $done({ body });
}

async function machine_subtitles(type) {
    body = body.replace(/\r/g, "");  // 移除回车符
    let dialogue = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d\n(?:.*\n)+?(?=\n\n|\n?$)/g);  // 匹配完整字幕块
    if (!dialogue) {
        console.log(`[Dualsub] No dialogue found in .vtt for URL: ${url}, body: ${body.slice(0, 200)}`);
        $done({});
    }
    console.log(`[Dualsub] Found ${dialogue.length} dialogue blocks`);
    let s_sentences = [];
    for (var i in dialogue) {
        let text = dialogue[i].replace(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d\n/, "").replace(/<\/*(c\.[^>]+|i|c)>/g, "").trim();
        if (text) s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${text}`);
    }
    if (s_sentences.length === 0) {
        console.log(`[Dualsub] No valid text to translate in .vtt`);
        $done({});
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
            try {
                let trans = await send_request(options, "post");
                if (trans.sentences) {
                    let sentences = trans.sentences;
                    for (var k in sentences) {
                        if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/〜|～/g, "~"));
                    }
                }
            } catch (error) {
                console.log(`[Dualsub] Google Translate error: ${error}`);
            }
        }
        if (trans_result.length > 0) t_sentences = trans_result.join("\n").match(/~\d+~[^~]+/g) || trans_result;
    }

    if (type == "DeepL") {
        for (var l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            };
            try {
                let trans = await send_request(options, "post");
                if (trans.translations) trans_result.push(trans.translations);
            } catch (error) {
                console.log(`[Dualsub] DeepL Translate error: ${error}`);
            }
        }
        if (trans_result.length > 0) {
            for (var o in trans_result) {
                for (var u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text);
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        console.log(`[Dualsub] Translated ${t_sentences.length} sentences`);
        for (var j in dialogue) {
            let patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`);
            let trans_text = type == "Google" ? t_sentences[j].replace(/^~\d+~\s*/, "") : t_sentences[j];
            if (setting.line == "s") body = body.replace(patt, `$1\n${trans_text}`);
            if (setting.line == "f") body = body.replace(patt, `${trans_text}\n$1`);
        }
        settings[service].s_subtitles_url = url;
        settings[service].subtitles = body;
        settings[service].subtitles_type = setting.type;
        settings[service].subtitles_sl = setting.sl;
        settings[service].subtitles_tl = setting.tl;
        settings[service].subtitles_line = setting.line;
        $persistentStore.write(JSON.stringify(settings));
        console.log(`[Dualsub] Subtitles updated and stored for ${url}`);
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
