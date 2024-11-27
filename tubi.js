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
            timeout: 1000  // 1秒超时
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
        if (!text) {
            translations.push("");
            continue;
        }
        
        const globalIndex = startIndex + i;
        try {
            const translated = await translate(text);
            console.log(`[${globalIndex + 1}/${subtitles.length}] "${text}" => "${translated}"`);
            translations.push(translated);
        } catch (e) {
            console.log(`翻译错误 [${globalIndex + 1}]:`, e);
            translations.push(text);
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms延迟
    }
    
    return translations;
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
            const cues = [];
            let currentCue = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (!line || line === "WEBVTT") continue;
                
                if (line.match(/^\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}/)) {
                    if (currentCue) {
                        currentCue.text = currentCue.text.filter(t => t);
                        cues.push(currentCue);
                    }
                    currentCue = {
                        timing: line,
                        text: []
                    };
                } else if (currentCue) {
                    currentCue.text.push(line);
                }
            }
            
            if (currentCue) {
                currentCue.text = currentCue.text.filter(t => t);
                cues.push(currentCue);
            }

            console.log(`找到字幕数: ${cues.length}`);
            
            if (cues.length === 0) {
                $done({ body });
                return;
            }

            // 处理字幕翻译
            const BATCH_SIZE = 2;
            let modifiedContent = "WEBVTT\n\n";
            
            for (let i = 0; i < cues.length; i += BATCH_SIZE) {
                const batch = cues.slice(i, i + BATCH_SIZE);
                const textsToTranslate = batch.map(cue => cue.text.join(" "));
                console.log(`处理批次 ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(cues.length/BATCH_SIZE)}`);
                
                const translations = await translateBatch(textsToTranslate, i, BATCH_SIZE);
                
                // 立即写入当前批次的字幕
                batch.forEach((cue, index) => {
                    const translation = translations[index];
                    // 每个字幕块的格式：时间轴 + 原文 + 翻译 + 空行
                    modifiedContent += cue.timing + "\n";  // 时间轴
                    modifiedContent += cue.text.join("\n") + "\n";  // 原文（保持原有的换行）
                    if (translation) {
                        modifiedContent += translation + "\n";  // 翻译
                    }
                    modifiedContent += "\n";  // 空行分隔
                });

                // 每处理10批显示进度
                if (i % (BATCH_SIZE * 10) === 0) {
                    console.log(`已处理 ${i}/${cues.length} 条字幕`);
                }
            }

            console.log("字幕重建完成");
            $done({ body: modifiedContent });
            return;
        }
        
        $done({});
        
    } finally {
        isProcessing = false;
    }
}

// 启动处理
processRequest();
