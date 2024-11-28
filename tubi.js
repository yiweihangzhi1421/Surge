/*
Tubi Subtitle Handler - Robust Version
*/

const $ = {
    isQuanX: typeof $task !== 'undefined',
    isSurge: typeof $httpClient !== 'undefined' && typeof $loon === 'undefined',
    isLoon: typeof $loon !== 'undefined',
};

// 基础设置
const config = {
    url: $request.url,
    timeout: 5000,      // 请求超时时间 ms
    maxRetry: 2,        // 最大重试次数
    delay: 500,         // 请求间隔时间 ms
    batchSize: 3        // 批处理大小
};

// 默认设置
const defaultSettings = {
    type: "Google",    // 翻译类型
    sl: "auto",        // 源语言
    tl: "zh",          // 目标语言
    line: "s",         // 字幕顺序：s(原文在上)，t(译文在上)
    retryInterval: 1000 // 重试间隔时间 ms
};

// 读取用户设置
let settings = {};
try {
    const savedSettings = $persistentStore.read('tubi_translate_settings');
    settings = savedSettings ? {...defaultSettings, ...JSON.parse(savedSettings)} : defaultSettings;
} catch (e) {
    settings = defaultSettings;
}

// HTTP请求封装(带超时和重试)
async function request(options, retryCount = 0) {
    return new Promise((resolve, reject) => {
        // 添加超时控制
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, config.timeout);

        // 发起请求
        $httpClient.post(options, (error, response, data) => {
            clearTimeout(timeout);
            if (error) {
                if (retryCount < config.maxRetry) {
                    setTimeout(() => {
                        request(options, retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, settings.retryInterval * (retryCount + 1));
                } else {
                    reject(error);
                }
                return;
            }
            resolve(data);
        });
    });
}

// 翻译函数
async function translate(text) {
    if (!text?.trim()) return '';
    
    const options = {
        url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
        headers: {
            'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
        },
        body: `q=${encodeURIComponent(text.trim())}`
    };

    try {
        const data = await request(options);
        const result = JSON.parse(data);
        return result.sentences?.map(s => s.trans).join('').trim() || '';
    } catch (e) {
        console.log(`翻译失败: ${text}`);
        return '';
    }
}

// 处理字幕块
async function processBlock(block) {
    const lines = block.split('\n');
    const timing = lines.find(line => line.includes(' --> '));
    
    if (!timing) return block;

    const textLines = lines.slice(lines.indexOf(timing) + 1);
    const text = textLines.join(' ').trim();
    
    if (!text) return block;

    // 检查是否是音效
    if (text.startsWith('[') && text.endsWith(']')) {
        const cleanText = text.slice(1, -1);
        const translated = await translate(cleanText);
        if (!translated) return block;
        return `${timing}\n${text}\n[${translated}]`;
    }

    // 处理说话人
    const speakerMatch = text.match(/^([^:：]+)[：:]\s*/);
    if (speakerMatch) {
        const speaker = speakerMatch[1];
        const content = text.slice(speakerMatch[0].length);
        const translated = await translate(content);
        if (!translated) return block;
        return `${timing}\n${text}\n${speaker}: ${translated}`;
    }

    // 普通文本
    const translated = await translate(text);
    if (!translated) return block;
    
    return settings.line === 's' ?
        `${timing}\n${text}\n${translated}` :
        `${timing}\n${translated}\n${text}`;
}

// 批量处理函数
async function processBatch(blocks, startIndex) {
    const endIndex = Math.min(startIndex + config.batchSize, blocks.length);
    const results = [];
    
    for (let i = startIndex; i < endIndex; i++) {
        const result = await processBlock(blocks[i]);
        results.push(result);
        // 处理间隔
        if (i < endIndex - 1) {
            await new Promise(r => setTimeout(r, config.delay));
        }
    }
    
    return results;
}

// 主处理函数
async function processSubtitles(body) {
    if (!body) return '';
    
    try {
        const blocks = body.split('\n\n').filter(b => b.trim());
        const result = ['WEBVTT\n'];
        
        // 批量处理所有字幕块
        for (let i = 0; i < blocks.length; i += config.batchSize) {
            const processedBatch = await processBatch(blocks, i);
            result.push(...processedBatch.map(b => b + '\n'));
            
            // 批次间隔
            if (i + config.batchSize < blocks.length) {
                await new Promise(r => setTimeout(r, config.delay * 2));
            }
        }

        return result.join('\n');
    } catch (e) {
        console.log('处理字幕错误:', e);
        return body;
    }
}

// 入口函数
async function main() {
    try {
        const body = $response.body;
        if (!body || !config.url.includes('.vtt')) {
            $done({});
            return;
        }

        const result = await processSubtitles(body);
        $done({
            body: result,
            headers: {'Content-Type': 'text/vtt;charset=utf-8'}
        });
    } catch (e) {
        console.log('脚本执行错误:', e);
        $done({});
    }
}

// 执行主函数
main();
