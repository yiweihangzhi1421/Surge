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
async function translate(text) {
    return new Promise((resolve) => {
        if (!text || text.trim() === "") {
            resolve("");
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
            timeout: 5000  // 设置5秒超时
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

// 分批翻译
async function translateBatch(subtitles, startIndex, batchSize) {
    const endIndex = Math.min(startIndex + batchSize, subtitles.length);
    const batch = subtitles.slice(startIndex, endIndex);
    const translations = [];
    
    for (let i = 0; i < batch.length; i++) {
        const text = batch[i];
        const globalIndex = startIndex + i;
        
        try {
            const translated = await translate(text);
            translations.push(translated);
            console.log(`[${globalIndex + 1}/${subtitles.length}] "${text}" => "${translated}"`);
        } catch (e) {
            console.log(`翻译错误 [${globalIndex + 1}]:`, e);
            translations.push(text);
        }
        // 增加延迟以避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return translations;
}

let isProcessing = false;

// 处理主流程
async function processRequest() {
    if (isProcessing) {
        console.log("已有处理进程在运行，跳过当前请求");
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

            const lines = body.split("\n");
            const timelineRegex = /^\d{2}:\d{2}[:.]\d{3}\s*-->\s*\d{2}:\d{2}[:.]\d{3}/;
            const subtitleItems = [];
            let currentItem = null;

            // 优化的字幕提取逻辑
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (timelineRegex.test(line)) {
                    if (currentItem) {
                        subtitleItems.push(currentItem);
                    }
                    currentItem = {
                        timeline: line,
                        text: []
                    };
                } else if (currentItem && line && !line.startsWith("WEBVTT")) {
                    currentItem.text.push(line);
                }
            }
            
            if (currentItem) {
                subtitleItems.push(currentItem);
            }

            if (subtitleItems.length === 0) {
                $done({ body });
                return;
            }

            console.log(`找到字幕数: ${subtitleItems.length}`);

            const BATCH_SIZE = 5;  // 减小批量大小
            const subtitles = subtitleItems.map(item => item.text.join(" "));
            const totalBatches = Math.ceil(subtitles.length / BATCH_SIZE);
            let translatedTexts = [];

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                console.log(`处理批次 ${batchIndex + 1}/${totalBatches}`);
                const startIndex = batchIndex * BATCH_SIZE;
                const translations = await translateBatch(subtitles, startIndex, BATCH_SIZE);
                translatedTexts = translatedTexts.concat(translations);
            }

            // 重建字幕文件
            let result = "WEBVTT\n\n";
            for (let i = 0; i < subtitleItems.length; i++) {
                const item = subtitleItems[i];
                const translatedText = translatedTexts[i];
                
                result += item.timeline + "\n";
                result += item.text.join("\n") + "\n";
                if (translatedText) {
                    result += translatedText + "\n";
                }
                result += "\n";
            }

            console.log("字幕重建完成");
            $done({ body: result });
            return;
        }

        // 其他文件类型
        $done({});
        
    } finally {
        isProcessing = false;
    }
}

// 启动处理
processRequest();
