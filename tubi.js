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
async function translate(text, retryCount = 3) {
    if (!text || text.trim() === "") {
        return "";
    }
    
    return new Promise((resolve) => {
        const doTranslate = () => {
            let url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" + encodeURIComponent(text);
            
            $httpClient.get({
                url: url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
                }
            }, function(error, response, data) {
                if (error) {
                    console.log('翻译错误:', error);
                    resolve(text);
                } else {
                    try {
                        let result = JSON.parse(data);
                        if (result && result[0] && result[0][0] && result[0][0][0]) {
                            let translated = result[0][0][0].trim();
                            if (translated) {
                                resolve(translated);
                                return;
                            }
                        }
                        resolve(text);
                    } catch (e) {
                        console.log('解析错误:', e);
                        resolve(text);
                    }
                }
            });
        };

        let attempt = 0;
        const tryTranslate = () => {
            if (attempt >= retryCount) {
                resolve(text);
                return;
            }
            
            try {
                doTranslate();
            } catch (e) {
                console.log(`翻译尝试 ${attempt + 1} 失败:`, e);
                attempt++;
                setTimeout(tryTranslate, 1000 * (attempt + 1));
            }
        };

        tryTranslate();
    });
}

// 分批翻译
async function translateBatch(subtitles, startIndex, batchSize) {
    let endIndex = Math.min(startIndex + batchSize, subtitles.length);
    let batch = subtitles.slice(startIndex, endIndex);
    let translations = [];
    
    for (let i = 0; i < batch.length; i++) {
        let text = batch[i];
        if (!text || text.trim() === "") {
            translations.push("");
            continue;
        }
        
        let globalIndex = startIndex + i;
        try {
            let translated = await translate(text);
            console.log(`[${globalIndex + 1}/${subtitles.length}]`);
            console.log(`原文: "${text}"`);
            console.log(`译文: "${translated}"`);
            translations.push(translated);
        } catch (e) {
            console.log(`翻译错误 [${globalIndex + 1}]:`, e);
            translations.push(text);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return translations;
}

// 处理主流程
function processRequest() {
    // 处理 m3u8 文件
    if (url.match(/\.m3u8/)) {
        console.log("处理 m3u8 文件");
        let patt = /#EXTINF:.+\n([^\n]+\.vtt)/;
        let match = body.match(patt);
        
        if (match && match[1]) {
            let subtitles_url = url.replace(/\/[^\/]+$/, "/" + match[1]);
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

        let lines = body.split("\n");
        let timelineRegex = /\d{2}:\d{2}[:.]\d{3}\s*-->\s*\d{2}:\d{2}[:.]\d{3}/;
        let timeline = [];
        let subtitles = [];
        let currentText = "";
        
        // 提取时间轴和字幕
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (timelineRegex.test(line)) {
                if (currentText) {
                    subtitles.push(currentText.trim());
                    currentText = "";
                }
                timeline.push(line);
            } else if (line && !line.startsWith("WEBVTT")) {
                if (currentText) currentText += " ";
                currentText += line;
            }
        }
        
        if (currentText) {
            subtitles.push(currentText.trim());
        }
        
        console.log("找到字幕数:", subtitles.length);
        
        if (timeline.length > 0 && subtitles.length > 0) {
            const BATCH_SIZE = 10;
            const totalBatches = Math.ceil(subtitles.length / BATCH_SIZE);
            let translatedTexts = [];
            
            async function processBatches(batchIndex = 0) {
                if (batchIndex >= totalBatches) {
                    let result = "WEBVTT\n\n";
                    for (let i = 0; i < timeline.length; i++) {
                        result += timeline[i] + "\n";
                        if (translatedTexts[i]) {
                            if (setting.line === "s") {
                                result += subtitles[i] + "\n";
                                result += translatedTexts[i] + "\n\n";
                            } else {
                                result += translatedTexts[i] + "\n";
                                result += subtitles[i] + "\n\n";
                            }
                        } else {
                            result += subtitles[i] + "\n\n";
                        }
                    }
                    
                    console.log("字幕重建完成");
                    console.log("总字幕条数:", timeline.length);
                    console.log("翻译条数:", translatedTexts.length);
                    
                    $done({ body: result });
                    return;
                }
                
                console.log(`处理批次 ${batchIndex + 1}/${totalBatches}`);
                const startIndex = batchIndex * BATCH_SIZE;
                const translations = await translateBatch(subtitles, startIndex, BATCH_SIZE);
                translatedTexts = translatedTexts.concat(translations);
                
                setTimeout(() => {
                    processBatches(batchIndex + 1);
                }, 1000);
            }
            
            // 开始处理第一批
            processBatches();
        } else {
            $done({ body });
        }
        return;
    }
    
    // 其他文件类型
    $done({});
}

// 启动处理
processRequest();
