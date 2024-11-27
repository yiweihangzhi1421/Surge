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
        type: "Google",
        lang: "English",
        sl: "auto",
        tl: "zh-CN",
        line: "s",
        dkey: "null"
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

let service = "Tubi";
if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 构建Google翻译URL
function buildGoogleTranslateUrl(text, sl, tl) {
    let baseUrl = "https://translate.googleapis.com/translate_a/single";
    let params = [
        "client=gtx",
        "sl=" + encodeURIComponent(sl),
        "tl=" + encodeURIComponent(tl),
        "dt=t",
        "q=" + encodeURIComponent(text)
    ].join("&");
    return baseUrl + "?" + params;
}

// HTTP 请求封装
function sendRequest(options) {
    return new Promise(function(resolve, reject) {
        $task.fetch(options).then(function(response) {
            try {
                let result = JSON.parse(response.body);
                resolve(result);
            } catch (e) {
                reject(e);
            }
        }, function(reason) {
            reject(reason);
        });
    });
}

// 翻译字幕文本
async function translateSubtitles(subtitles, engine, sl, tl) {
    let translated = [];
    let i = 0;
    
    try {
        if (engine === "Google") {
            for (i = 0; i < subtitles.length; i++) {
                if (!subtitles[i].trim()) {
                    translated.push("");
                    continue;
                }

                let url = buildGoogleTranslateUrl(subtitles[i], sl, tl);
                console.log("Translating:", subtitles[i]);
                console.log("URL:", url);

                let options = {
                    url: url,
                    method: "GET",
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                };

                try {
                    let response = await sendRequest(options);
                    console.log("Response:", JSON.stringify(response));
                    
                    if (response && response[0]) {
                        let translatedText = "";
                        for (let j = 0; j < response[0].length; j++) {
                            if (response[0][j][0]) {
                                translatedText += response[0][j][0];
                            }
                        }
                        console.log("Translated:", translatedText);
                        translated.push(translatedText || subtitles[i]);
                    } else {
                        translated.push(subtitles[i]);
                    }
                } catch (err) {
                    console.error("Translation error for text:", subtitles[i], err);
                    translated.push(subtitles[i]);
                }
            }
        }
    } catch (err) {
        console.error("Translation error:", err);
    }
    
    return translated;
}

// 重建 WebVTT 文件
function rebuildVTT(timeline, original, translated, line) {
    let result = "WEBVTT\n\n";
    console.log("Rebuilding VTT with:", {
        timelineCount: timeline.length,
        originalCount: original.length,
        translatedCount: translated.length,
        lineOrder: line
    });

    for (let i = 0; i < timeline.length; i++) {
        result += timeline[i] + "\n";
        if (line === "s") {
            console.log("Subtitle pair " + (i + 1) + ":", {
                original: original[i],
                translated: translated[i]
            });
            result += original[i] + "\n" + translated[i] + "\n\n";
        } else if (line === "f") {
            console.log("Subtitle pair " + (i + 1) + ":", {
                translated: translated[i],
                original: original[i]
            });
            result += translated[i] + "\n" + original[i] + "\n\n";
        }
    }
    return result;
}

// 处理 .m3u8 文件
if (url.match(/\.m3u8/)) {
    console.log("Processing .m3u8 file...");
    
    let body = $response.body;
    console.log("Original .m3u8 Content:\n", body);

    let patt = /#EXTINF:.+\n([^\n]+\.vtt)/;
    let match = body.match(patt);

    if (match && match[1]) {
        let subtitles_url = url.replace(/\/[^\/]+$/, "/" + match[1]);
        console.log("Extracted subtitles URL:", subtitles_url);
        settings[service].t_subtitles_url = subtitles_url;
        saveSetting("settings", JSON.stringify(settings));
    } else {
        console.error("Failed to extract subtitles URL from .m3u8 file.");
    }

    $done({ body });
}

// 处理 .vtt 文件
if (url.match(/\.vtt/)) {
    console.log("Processing .vtt file...");
    console.log("Current settings:", JSON.stringify({
        type: setting.type,
        lang: setting.lang,
        sl: setting.sl,
        tl: setting.tl,
        line: setting.line
    }, null, 2));

    if (setting.type === "Disable") {
        console.log("Translation disabled");
        $done({ body: $response.body });
    }

    let body = $response.body;
    if (!body || body.trim() === "") {
        console.error("Empty .vtt file content");
        $done({ body });
    }

    // 解析 WebVTT 文件
    let lines = body.split("\n");
    let timelineRegex = /\d{2}:\d{2}.\d{3} --> \d{2}:\d{2}.\d{3}/;
    let timeline = [];
    let subtitles = [];

    for (let i = 0; i < lines.length; i++) {
        if (timelineRegex.test(lines[i])) {
            timeline.push(lines[i]);
            subtitles.push(lines[i + 1]?.trim() || "");
            i++;
        }
    }

    console.log("Parsed timeline count:", timeline.length);
    console.log("Parsed subtitles count:", subtitles.length);

    if (!timeline.length || !subtitles.length) {
        console.error("Failed to parse .vtt file");
        $done({ body });
    }

    translateSubtitles(subtitles, setting.type, setting.sl, setting.tl).then(function(translated) {
        console.log("Translation completed");
        let translatedBody = rebuildVTT(timeline, subtitles, translated, setting.line);
        console.log("Final VTT content generated");
        $done({ body: translatedBody });
    }).catch(function(err) {
        console.error("Translation failed:", err);
        $done({ body });
    });
}
