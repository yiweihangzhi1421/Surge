// Peacock双语字幕脚本 for Surge
// 作者: @ChatGPT
// 功能: 为Peacock视频添加双语字幕功能
// 使用: 添加MitM hostname: *.cdn.peacocktv.com

console.log('[Peacock] Script started');

let url = $request.url;
let headers = $request.headers;
let body = $response.body;

// 基础配置
let settings = {
    enabled: true,          // 是否启用双语字幕
    primaryLang: "zh-CN",   // 主要语言(中文)
    secondaryLang: "en",    // 次要语言(英文)
    linePosition: "s",      // s: 第二行, f: 第一行
    translateType: "Google", // 翻译类型: Google, Disable
    timeout: 60000          // 超时时间: 60秒
};

// 从持久化存储加载配置
function loadSettings() {
    console.log('[Peacock] Loading settings');
    let savedSettings = $persistentStore.read('peacockDualsubSettings');
    if (savedSettings) {
        try {
            settings = JSON.parse(savedSettings);
            console.log('[Peacock] Settings loaded successfully');
        } catch (error) {
            console.log('[Peacock] Load settings failed, using default settings:', error);
        }
    }
}

// 保存配置到持久化存储
function saveSettings() {
    console.log('[Peacock] Saving settings');
    $persistentStore.write(JSON.stringify(settings), 'peacockDualsubSettings');
}

// 网络请求封装
async function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, settings.timeout);

        $httpClient.get(options, (error, response, data) => {
            clearTimeout(timeoutId);
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

// 字幕处理主函数
async function processSubtitles(body) {
    console.log('[Peacock] Processing subtitles');
    if (!settings.enabled || !body) return body;

    // 标准化换行符
    body = body.replace(/\r/g, "");
    
    // 查找所有字幕片段
    let subtitles = body.split('\n\n');
    let processedSubtitles = [];
    
    // 处理WEBVTT头部
    let header = subtitles[0];
    processedSubtitles.push(header);
    
    // 处理每个字幕片段
    for (let i = 1; i < subtitles.length; i++) {
        let subtitle = subtitles[i];
        if (!subtitle.trim()) continue;
        
        // 提取时间轴和文本
        let parts = subtitle.split('\n');
        if (parts.length < 2) continue;
        
        let timeCode = parts[1];
        let text = parts.slice(2).join(' ').trim();
        
        // 跳过空文本
        if (!text) {
            processedSubtitles.push(subtitle);
            continue;
        }
        
        // 如果已经是双语字幕，跳过翻译
        if (text.match(/\[.*?\].*?\[.*?\]/)) {
            processedSubtitles.push(subtitle);
            continue;
        }
        
        // 翻译文本
        let translatedText = '';
        if (settings.translateType === "Google") {
            try {
                translatedText = await translateText(text);
                console.log('[Peacock] Translation success');
            } catch (error) {
                console.log('[Peacock] Translation failed:', error);
                translatedText = text;
            }
        }
        
        // 组合双语字幕
        let bilingualSubtitle = '';
        if (settings.linePosition === 's') {
            bilingualSubtitle = `${timeCode}\n${text}\n${translatedText}`;
        } else {
            bilingualSubtitle = `${timeCode}\n${translatedText}\n${text}`;
        }
        
        processedSubtitles.push(bilingualSubtitle);
    }
    
    return processedSubtitles.join('\n\n');
}

// Google翻译API
async function translateText(text) {
    if (settings.translateType !== "Google") return text;
    
    let options = {
        url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${settings.secondaryLang}&tl=${settings.primaryLang}&dt=t&q=${encodeURIComponent(text)}`,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    return new Promise((resolve, reject) => {
        $httpClient.get(options, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                let translated = JSON.parse(data);
                let translatedText = '';
                
                // 合并所有翻译片段
                if (translated[0]) {
                    translatedText = translated[0]
                        .map(item => item[0])
                        .join('')
                        .trim();
                }
                
                resolve(translatedText || text);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

// 处理字幕样式
function preserveStyle(originalText, translatedText) {
    let styleMatch = originalText.match(/<[^>]+>/g);
    if (styleMatch) {
        for (let style of styleMatch) {
            if (!translatedText.includes(style)) {
                translatedText = style + translatedText + style.replace('<', '</');
            }
        }
    }
    return translatedText;
}

// 主函数
async function main() {
    try {
        console.log('[Peacock] Main function started');
        loadSettings();
        
        // 处理配置获取请求
        if (url.match(/action=get/)) {
            console.log('[Peacock] Handling get settings request');
            $done({ 
                response: { 
                    body: JSON.stringify(settings),
                    headers: { 'Content-Type': 'application/json' }
                }
            });
            return;
        }
        
        // 处理配置更新请求
        if (url.match(/action=set/)) {
            console.log('[Peacock] Handling set settings request');
            let newSettings = JSON.parse($request.body);
            settings = { ...settings, ...newSettings };
            saveSettings();
            $done({ 
                response: { 
                    body: JSON.stringify(settings),
                    headers: { 'Content-Type': 'application/json' }
                }
            });
            return;
        }
        
        // 处理字幕文件
        if (url.match(/\.(vtt|srt)$/)) {
            console.log('[Peacock] Processing subtitle file');
            let processedBody = await processSubtitles(body);
            console.log('[Peacock] Subtitle processing completed');
            $done({ body: processedBody });
            return;
        }
        
        // 其他请求直接放行
        console.log('[Peacock] Passing through other requests');
        $done({});
        
    } catch (error) {
        console.log('[Peacock] Main function error:', error);
        $notification.post('Peacock双语字幕', '处理失败', error.message);
        $done({});
    }
}

// 启动脚本
console.log('[Peacock] Script starting...');
main().catch(error => {
    console.log('[Peacock] Fatal error:', error);
    $notification.post('Peacock双语字幕', '脚本错误', error.message);
    $done({});
});
