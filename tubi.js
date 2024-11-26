let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Tubi: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "zh-CN",
        line: "s", // f (翻译行在前), s (原文行在前)
        dkey: "null", // DeepL API 密钥
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

let settings = $prefs.valueForKey("settings");
if (!settings) settings = default_settings;
if (typeof settings == "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/s\.adrise\.tv/)) service = "Tubi";

if (!service) $done({});

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

if (url.match(/\.m3u8/)) {
    let patt = /#EXTINF:.+\n(.+\.vtt)/;
    if (body.match(patt)) {
        let subtitles_url = url.replace(/\/[^\/]+$/, `/${body.match(patt)[1]}`);
        settings[service].t_subtitles_url = subtitles_url;
        $prefs.setValueForKey(JSON.stringify(settings), "settings");
    }
    $done({ body });
}

if (url.match(/\.vtt/)) {
    if (setting.type == "Disable") $done({ body });
    
    let lines = body.split("\n");
    let timelineRegex = /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/;
    let timeline = [];
    let subtitles = [];

    for (let i = 0; i < lines.length; i++) {
        if (timelineRegex.test(lines[i])) {
            timeline.push(lines[i]);
            subtitles.push(lines[i + 1]);
            i++;
        }
    }

    translateSubtitles(subtitles, setting.type, setting.sl, setting.tl).then(translated => {
        let translatedBody = rebuildVTT(timeline, subtitles, translated, setting.line);
        $done({ body: translatedBody });
    });
}

async function translateSubtitles(subtitles, engine, sl, tl) {
    let translated = [];
    if (engine == "Google") {
        for (let i = 0; i < subtitles.length; i++) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&sl=${sl}&tl=${tl}`,
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `q=${encodeURIComponent(subtitles[i])}`
            };
            let response = await send_request(options);
            translated.push(response.sentences[0].trans);
        }
    } else if (engine == "DeepL") {
        for (let i = 0; i < subtitles.length; i++) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `auth_key=${setting.dkey}&text=${encodeURIComponent(subtitles[i])}&target_lang=${tl}`
            };
            let response = await send_request(options);
            translated.push(response.translations[0].text);
        }
    }
    return translated;
}

function rebuildVTT(timeline, original, translated, line) {
    let result = "WEBVTT\n\n";
    for (let i = 0; i < timeline.length; i++) {
        result += `${timeline[i]}\n`;
        if (line == "s") {
            result += `${original[i]}\n${translated[i]}\n\n`;
        } else if (line == "f") {
            result += `${translated[i]}\n${original[i]}\n\n`;
        }
    }
    return result;
}

function send_request(options) {
    return new Promise((resolve, reject) => {
        $task.fetch(options).then(response => {
            resolve(JSON.parse(response.body));
        }, reason => reject(reason));
    });
}
