// Peacock双语字幕脚本 for Surge
// 更新: 2024.03.21
// 功能: 为Peacock视频添加双语字幕

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
    timeout: 120000,        // 超时时间: 120秒
    retryCount: 3           // 重试次数
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
            $notification.post('Peacock双语字幕', '加载配置失败', '使用默认配置');
        }
    }
}

// 保存配置
function saveSettings() {
    try {
        $persistentStore.write(JSON.stringify(settings), 'peacockDualsubSettings');
        console.log('[Peacock] Settings saved successfully');
    } catch (error) {
        console.log('[Peacock] Save settings failed:', error);
        $notification.post('Peacock双语字幕', '保存配置失败', error.message);
    }
}

// 网络请求处理
async function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, settings.timeout);

        $httpClient.get({
            ...options,
            headers: {
                ...options.headers,
                'Accept': 'application/octet-stream',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
            }
        }, (error, response, data) => {
            clearTimeout(timeoutId);
            
            if (error) {
                console.log('[Peacock] Request failed:', error);
                reject(error);
                return;
            }

            // 检查响应状态
            if (response.status !== 200) {
                reject(new Error(`HTTP Error: ${response.status}`));
                return;
            }

            // 检查内容类型
            const contentType = response.headers['Content-Type'];
            if (contentType && !contentType.includes('application/octet-stream') && !contentType.includes('text/')) {
                console.log('[Peacock] Unexpected content type:', contentType);
            }

            resolve(data);
        });
    });
}

// 带重试的请求
async function makeRequestWithRetry(options) {
    let lastError;
    for (let i = 0; i < settings.retryCount; i++) {
        try {
            console.log(`[Peacock] Request attempt ${i + 1}`);
            return await makeRequest(options);
        } catch (error) {
            lastError = error;
            console.log(`[Peacock] Request failed, attempt ${i + 1}:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw lastError;
}

// 字幕处理
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

// Google翻译
async function translateText(text) {
    if (settings.translateType !== "Google") return text;
    
    let options = {
        url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${settings.secondaryLang}&tl=${settings.primaryLang}&dt=t&q=${encodeURIComponent(text)}`,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    try {
        const data = await makeRequestWithRetry(options);
        let translated = JSON.parse(data);
        if (translated[0]) {
            return translated[0]
                .map(item => item[0])
                .join('')
                .trim() || text;
        }
    } catch (error) {
        console.log('[Peacock] Translation error:', error);
        throw error;
    }

    return text;
}

// 主函数
async function main() {
    try {
        console.log('[Peacock] Processing URL:', url);
        
        // 检查响应头
        if ($response.headers) {
            console.log('[Peacock] Response headers:', JSON.stringify($response.headers));
        }

        // 检查是否是字幕文件
        if (!url.match(/\.(vtt|srt|webvtt)$/i)) {
            console.log('[Peacock] Not a subtitle file, passing through');
            $done({});
            return;
        }

        // 检查body
        if (!body) {
            console.log('[Peacock] No body found');
            $done({});
            return;
        }

        loadSettings();
        
        if (!settings.enabled) {
            console.log('[Peacock] Script disabled');
            $done({});
            return;
        }

        // 处理字幕
        const processedBody = await processSubtitles(body);
        
        if (!processedBody) {
            console.log('[Peacock] No processed body');
            $done({});
            return;
        }

        // 设置响应
        console.log('[Peacock] Processing completed');
        $done({
            body: processedBody,
            headers: {
                ...$response.headers,
                'Content-Length': processedBody.length.toString(),
                'Content-Type': 'application/octet-stream',
                'Cache-Control': 'no-cache'
            }
        });
        
    } catch (error) {
        console.log('[Peacock] Error in main:', error);
        $notification.post('Peacock字幕处理', '处理失败', error.message);
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
