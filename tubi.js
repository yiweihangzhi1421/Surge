let url = $request.url;

// 存储函数
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

// 构建翻译URL
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

// 重建 WebVTT 文件
function rebuildVTT(timeline, original, translated, line) {
    let result = "WEBVTT\n\n";
    console.log("Rebuilding VTT with line order:", line);

    for (let i = 0; i < timeline.length; i++) {
        result += timeline[i] + "\n";
        if (line === "s") {
            result += original[i] + "\n" + translated[i] + "\n\n";
        } else if (line === "f") {
            result += translated[i] + "\n" + original[i] + "\n\n";
        }
    }
    return result;
}

// 处理 m3u8 文件
if (url.match(/\.m3u8/)) {
    let body = $response.body;
    console.log("Processing m3u8 file");
    
    let patt = /#EXTINF:.+\n([^\n]+\.vtt)/;
    let match = body.match(patt);
    
    if (match && match[1]) {
        let subtitles_url = url.replace(/\/[^\/]+$/, "/" + match[1]);
        console.log("Found subtitles URL:", subtitles_url);
        settings[service].t_subtitles_url = subtitles_url;
        saveSetting("settings", JSON.stringify(settings));
    }
    
    $done({ body });
}

// 处理 vtt 文件
else if (url.match(/\.vtt/)) {
    let body = $response.body;
    console.log("Processing VTT file");
    console.log("Current settings:", JSON.stringify(setting));
    
    if (setting.type === "Disable" || !body || body.trim() === "") {
        $done({ body });
    }
    
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
    
    console.log("Found subtitles:", subtitles.length);
    
    if (timeline.length > 0 && subtitles.length > 0) {
        // 翻译所有字幕
        let pendingTranslations = subtitles.map(function(text, index) {
            if (!text.trim()) {
                return Promise.resolve("");
            }
            
            let url = buildGoogleTranslateUrl(text, setting.sl, setting.tl);
            let options = {
                url: url,
                method: "GET",
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };
            
            console.log("Translating:", text);
            console.log("Translation URL:", url);
            
            return $task.fetch(options).then(function(response) {
                try {
                    let result = JSON.parse(response.body);
                    if (result && result[0]) {
                        let translatedText = "";
                        for (let j = 0; j < result[0].length; j++) {
                            if (result[0][j][0]) {
                                translatedText += result[0][j][0];
                            }
                        }
                        console.log("Translated text:", translatedText);
                        return translatedText || text;
                    }
                    return text;
                } catch (e) {
                    console.error("Translation error:", e);
                    return text;
                }
            }).then(null, function() {
                return text;
            });
        });
        
        Promise.all(pendingTranslations).then(function(translated) {
            let translatedBody = rebuildVTT(timeline, subtitles, translated, setting.line);
            $done({ body: translatedBody });
        }).then(null, function(error) {
            console.error("Translation failed:", error);
            $done({ body });
        });
    } else {
        $done({ body });
    }
}

// 其他文件类型
else {
    $done({});
}
