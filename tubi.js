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

// 预定义翻译
const commonTranslations = {
    "Gossip Girl": "绯闻女孩",
    "Upper East Siders": "上东区的人们",
    "Grand Central": "中央车站",
    "boarding school": "寄宿学校"
};

// 翻译函数
async function translate(text) {
    return new Promise((resolve) => {
        if (!text || text.trim() === "") {
            resolve("");
            return;
        }

        // 替换已知翻译
        for (const [key, value] of Object.entries(commonTranslations)) {
            if (text.includes(key)) {
                text = text.replace(new RegExp(key, 'g'), value);
            }
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
                console.log('翻译失败:', error);
                resolve(text);
                return;
            }

            try {
                let result = JSON.parse(data);
                if (result?.[0]?.[0]?.[0]) {
                    let translated = result[0][0][0].trim();
                    resolve(translated || text);
                } else {
                    resolve(text);
                }
            } catch (e) {
                console.log('解析错误:', e);
                resolve(text);
            }
        });
    });
}

// 判断是否是特殊内容
function isSpecialContent(text) {
    return text.match(/^\[.*\]$/) || text.includes("♪");
}

// 主处理流程
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
            
            if (!body || body.trim() === "") {
                $done({ body });
                return;
            }

            const lines = body.split("\n");
            let output = "WEBVTT\n\n";
            let currentTime = null;
            let currentText = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (!line || line === "WEBVTT") continue;
                
                // 检查是否是时间戳行
                if (line.match(/^\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}/)) {
                    // 处理前一个块
                    if (currentTime && currentText.length > 0) {
                        const text = currentText.join("\n");
                        if (isSpecialContent(text)) {
                            output += `${currentTime}\n${text}\n\n`;
                        } else {
                            try {
                                const translation = await translate(text);
                                if (translation && translation !== text) {
                                    output += `${currentTime}\n${text}\n${translation}\n\n`;
                                } else {
                                    output += `${currentTime}\n${text}\n\n`;
                                }
                            } catch (e) {
                                console.log('翻译错误:', e);
                                output += `${currentTime}\n${text}\n\n`;
                            }
                        }
                    }
                    
                    // 开始新的字幕块
                    currentTime = line;
                    currentText = [];
                } else if (line) {
                    currentText.push(line);
                }
            }

            // 处理最后一个字幕块
            if (currentTime && currentText.length > 0) {
                const text = currentText.join("\n");
                if (isSpecialContent(text)) {
                    output += `${currentTime}\n${text}\n\n`;
                } else {
                    try {
                        const translation = await translate(text);
                        if (translation && translation !== text) {
                            output += `${currentTime}\n${text}\n${translation}\n\n`;
                        } else {
                            output += `${currentTime}\n${text}\n\n`;
                        }
                    } catch (e) {
                        console.log('翻译错误:', e);
                        output += `${currentTime}\n${text}\n\n`;
                    }
                }
            }

            console.log("字幕处理完成");
            $done({ body: output.trim() });
            return;
        }
        
        $done({});
        
    } catch (error) {
        console.log("处理错误:", error);
        $done({ body });
    } finally {
        isProcessing = false;
    }
}

// 启动处理
processRequest();
