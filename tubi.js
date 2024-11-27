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

let isProcessing = false;

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

// 处理特殊字幕内容
function processSubtitleText(text) {
    if (text.match(/^\[.*\]$/)) {
        return text; // 如果是音效描述，保持原样
    }
    text = text.trim();
    if (text === "") return "";
    return text;
}

// 翻译函数
async function translate(text) {
    return new Promise((resolve) => {
        if (!text || text.trim() === "") {
            resolve("");
            return;
        }

        // 检查是否是音效描述
        if (text.match(/^\[.*\]$/)) {
            resolve(text);
            return;
        }

        const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" + encodeURIComponent(text);
        
        $httpClient.get({
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
            },
            timeout: 2000
        }, function(error, response, data) {
            if (error) {
                console.log('翻译错误:', error);
                resolve(text);
            } else {
                try {
                    let result = JSON.parse(data);
                    if (result && result[0] && result[0][0] && result[0][0][0]) {
                        let translated = result[0][0][0].trim();
                        resolve(translated || text);
                    } else {
                        resolve(text);
                    }
                } catch (e) {
                    console.log('解析错误:', e);
                    resolve(text);
                }
            }
        });
    });
}

// 处理主流程
async function processRequest() {
    if (isProcessing) {
        console.log("已有处理进程在运行，跳过");
        $done({});
        return;
    }
    
    isProcessing = true;
    
    try {
        // 处理 m3u8 文件
        if (url.match(/\.m3u8/)) {
            console.log("处理 m3u8 文件");
            const patt = /#EXTINF:.+\n([^\n]+\.vtt)/;
            const match = body.match(patt);
            
            if (match && match[1]) {
                const subtitles_url = url.replace(/\/[^\/]+$/, "/" + match[1]);
                console.log("找到字幕 URL:", subtitles_url);
                settings[service].t_subtitles_url = subtitles_url;
                saveSetting("settings", JSON.stringify(settings));
            }
            
            $done({ body });
            return;
        }
        
        // 处理 vtt 文件
        if (url.match(/\.vtt/)) {
            console.log("处理 VTT 文件");
            
            if (setting.type === "Disable" || !body || body.trim() === "") {
                $done({ body });
                return;
            }

            // 解析VTT文件
            const lines = body.split("\n");
            let output = "WEBVTT\n\n";
            let currentTime = "";
            let currentText = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (!line || line === "WEBVTT") continue;
                
                if (line.match(/^\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}/)) {
                    // 如果有之前的字幕块，先处理它
                    if (currentTime && currentText.length > 0) {
                        const text = currentText.join("\n");
                        if (text.match(/^\[.*\]$/)) {
                            // 音效描述，直接添加
                            output += currentTime + "\n" + text + "\n\n";
                        } else {
                            // 处理普通文本
                            const translation = await translate(text);
                            output += currentTime + "\n" + text + "\n" + translation + "\n\n";
                        }
                    }
                    
                    // 开始新的字幕块
                    currentTime = line;
                    currentText = [];
                } else {
                    currentText.push(line);
                }
            }
            
            // 处理最后一个字幕块
            if (currentTime && currentText.length > 0) {
                const text = currentText.join("\n");
                if (text.match(/^\[.*\]$/)) {
                    output += currentTime + "\n" + text + "\n\n";
                } else {
                    const translation = await translate(text);
                    output += currentTime + "\n" + text + "\n" + translation + "\n\n";
                }
            }

            console.log("字幕处理完成");
            $done({ body: output.trim() });
            return;
        }
        
        $done({});
        
    } catch (error) {
        console.log("处理错误:", error);
        $done({});
    } finally {
        isProcessing = false;
    }
}

// 启动处理
processRequest();
