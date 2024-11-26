let url = $request.url;

// Surge 持久化存储函数
function saveSetting(key, value) {
    return $persistentStore.write(value, key);
}

function loadSetting(key) {
    return $persistentStore.read(key) || null;
}

// 默认设置
let default_settings = {
    Tubi: {
        type: "Google", // 翻译引擎：Google, DeepL, External, Disable
        lang: "English",
        sl: "auto", // 源语言
        tl: "zh-CN", // 目标语言
        line: "s", // "f" 翻译在上，"s" 原文在上
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

// 加载设置
let settings = loadSetting("settings");
if (!settings) {
    settings = default_settings;
    saveSetting("settings", JSON.stringify(settings));
} else {
    settings = JSON.parse(settings);
}

let service = "";
if (url.match(/s\.adrise\.tv/)) service = "Tubi";

if (!service) $done({});
if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 处理 .m3u8 文件
if (url.match(/\.m3u8/)) {
    let patt = /#EXTINF:.+\n(.+\.vtt)/;
    if (body.match(patt)) {
        let subtitles_url = url.replace(/\/[^\/]+$/, `/${body.match(patt)[1]}`);
        settings[service].t_subtitles_url = subtitles_url;
        saveSetting("settings", JSON.stringify(settings));
    }
    $done({ body });
}

// 处理 .vtt 文件
if (url.match(/\.vtt/)) {
    console.log("Processing .vtt file:", url);

    if (setting.type === "Disable") {
        console.log("Translation disabled, returning original subtitles.");
        $done({ body });
    }

    // 解析 WebVTT 文件
    let lines = body.split("\n");
    let timelineRegex = /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/;
    let timeline = [];
    let subtitles = [];

    for (let i = 0; i < lines.length; i++) {
        if (timelineRegex.test(lines[i])) {
            timeline.push(lines[i]); // 保存时间轴
            subtitles.push(lines[i + 1] || ""); // 保存字幕文本
            i++; // 跳过字幕文本行
        }
    }

    console.log("Parsed timeline:", timeline);
    console.log("Parsed subtitles:", subtitles);

    // 调用翻译服务
    translateSubtitles(subtitles, setting.type, setting.sl, setting.tl).then(translated => {
        console.log("Translated subtitles:", translated);

        // 重建 WebVTT 文件
        let translatedBody = rebuildVTT(timeline, subtitles, translated, setting.line);
        console.log("Generated WEBVTT Content:\n", translatedBody);

        $done({ body: translatedBody });
    }).catch(err => {
        console.error("Translation failed:", err);
        $done({ body });
    });
}

// 重建 WebVTT 文件
function rebuildVTT(timeline, original, translated, line) {
    let result = "WEBVTT\n\n";
    for (let i = 0; i < timeline.length; i++) {
        result += `${timeline[i]}\n`;
        if (original[i].trim() === "") {
            result += `\n\n`;
        } else if (line === "s") {
            result += `${original[i]}\n${translated[i]}\n\n`; // 原文在上，翻译在下
        } else if (line === "f") {
            result += `${translated[i]}\n${original[i]}\n\n`; // 翻译在上，原文在下
        }
    }
    return result;
}

// 翻译字幕文本
async function translateSubtitles(subtitles, engine, sl, tl) {
    let translated = [];
    if (engine === "Google") {
        for (let i = 0; i < subtitles.length; i++) {
            if (subtitles[i].trim() === "") {
                translated.push(""); // 跳过空白字幕
                continue;
            }
            let options = {
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(subtitles[i])}`,
                method: "GET"
            };
            try {
                let response = await send_request(options);
                translated.push(response[0]?.[0]?.[0] || subtitles[i]);
            } catch (e) {
                console.error("Translation error:", e);
                translated.push(subtitles[i]);
            }
        }
    } else if (engine === "DeepL") {
        for (let i = 0; i < subtitles.length; i++) {
            if (subtitles[i].trim() === "") {
                translated.push(""); // 跳过空白字幕
                continue;
            }
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `auth_key=${setting.dkey}&text=${encodeURIComponent(subtitles[i])}&target_lang=${tl}`
            };
            try {
                let response = await send_request(options);
                translated.push(response.translations?.[0]?.text || subtitles[i]);
            } catch (e) {
                console.error("Translation error:", e);
                translated.push(subtitles[i]);
            }
        }
    }
    return translated;
}

// HTTP 请求封装
function send_request(options) {
    return new Promise((resolve, reject) => {
        $task.fetch(options).then(response => {
            try {
                resolve(JSON.parse(response.body));
            } catch (e) {
                reject(e);
            }
        }, reason => reject(reason));
    });
}
