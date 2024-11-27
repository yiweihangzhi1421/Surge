let url = $request.url;
let body = $response.body;

// 存储功能
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

// 翻译函数
function translate(text) {
    return new Promise((resolve) => {
        if (!text.trim()) {
            resolve("");
        } else {
            let url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" + encodeURIComponent(text);
            
            $httpClient.get({
                url: url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
                }
            }, function(error, response, data) {
                if (error) {
                    console.log('Translation error:', error);
                    resolve(text);
                } else {
                    try {
                        let result = JSON.parse(data);
                        if (result && result[0] && result[0][0] && result[0][0][0]) {
                            resolve(result[0][0][0]);
                        } else {
                            resolve(text);
                        }
                    } catch (e) {
                        console.log('Parse error:', e);
                        resolve(text);
                    }
                }
            });
        }
    });
}

// 处理主流程
function processRequest() {
    // 处理 m3u8 文件
    if (url.match(/\.m3u8/)) {
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
        console.log("Processing VTT file");
        
        if (setting.type === "Disable" || !body || body.trim() === "") {
            $done({ body });
        } else {
            let lines = body.split("\n");
            let timelineRegex = /\d{2}:\d{2}.\d{3} --> \d{2}:\d{2}.\d{3}/;
            let timeline = [];
            let subtitles = [];
            
            // 提取时间轴和字幕
            for (let i = 0; i < lines.length; i++) {
                if (timelineRegex.test(lines[i])) {
                    timeline.push(lines[i]);
                    subtitles.push(lines[i + 1]?.trim() || "");
                    i++;
                }
            }
            
            console.log("Found", subtitles.length, "subtitles");
            
            if (timeline.length > 0 && subtitles.length > 0) {
                // 批量翻译
                let promises = subtitles.map((text, index) => {
                    // 添加延迟以避免请求过于密集
                    return new Promise(resolve => {
                        setTimeout(() => {
                            translate(text).then(translated => {
                                console.log(`[${index + 1}/${subtitles.length}] Original: "${text}" => "${translated}"`);
                                resolve(translated);
                            });
                        }, index * 300); // 每300ms发送一个请求
                    });
                });
                
                Promise.all(promises).then(translatedTexts => {
                    let result = "WEBVTT\n\n";
                    
                    // 重建字幕文件
                    for (let i = 0; i < timeline.length; i++) {
                        result += timeline[i] + "\n";
                        if (setting.line === "s") {
                            result += subtitles[i] + "\n" + translatedTexts[i] + "\n\n";
                        } else {
                            result += translatedTexts[i] + "\n" + subtitles[i] + "\n\n";
                        }
                    }
                    
                    $done({ body: result });
                });
            } else {
                $done({ body });
            }
        }
    }
    // 其他文件类型
    else {
        $done({});
    }
}

// 启动处理
processRequest();
