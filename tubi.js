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

// 分批翻译
async function translateBatch(subtitles, startIndex, batchSize) {
    let endIndex = Math.min(startIndex + batchSize, subtitles.length);
    let batch = subtitles.slice(startIndex, endIndex);
    let translations = [];
    
    for (let i = 0; i < batch.length; i++) {
        let text = batch[i];
        let globalIndex = startIndex + i;
        try {
            let translated = await translate(text);
            console.log(`[${globalIndex + 1}/${subtitles.length}] Original: "${text}" => "${translated}"`);
            translations.push(translated);
        } catch (e) {
            console.log(`Error translating [${globalIndex + 1}]:`, e);
            translations.push(text);
        }
        // 添加100ms延迟
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return translations;
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
                const BATCH_SIZE = 20; // 每批处理20条字幕
                const totalBatches = Math.ceil(subtitles.length / BATCH_SIZE);
                let translatedTexts = [];
                
                async function processBatches(batchIndex = 0) {
                    if (batchIndex >= totalBatches) {
                        // 所有批次处理完成，重建字幕文件
                        let result = "WEBVTT\n\n";
                        for (let i = 0; i < timeline.length; i++) {
                            result += timeline[i] + "\n";
                            if (setting.line === "s") {
                                result += subtitles[i] + "\n" + translatedTexts[i] + "\n\n";
                            } else {
                                result += translatedTexts[i] + "\n" + subtitles[i] + "\n\n";
                            }
                        }
                        $done({ body: result });
                        return;
                    }
                    
                    console.log(`Processing batch ${batchIndex + 1}/${totalBatches}`);
                    const startIndex = batchIndex * BATCH_SIZE;
                    const translations = await translateBatch(subtitles, startIndex, BATCH_SIZE);
                    translatedTexts = translatedTexts.concat(translations);
                    
                    // 处理下一批
                    setTimeout(() => {
                        processBatches(batchIndex + 1);
                    }, 500); // 每批之间等待500ms
                }
                
                // 开始处理第一批
                processBatches();
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
