// 用于Surge的字幕翻译脚本
const $ = new Env('VTT Translator');
let url = $request.url;
let body = $response.body;

// 缓存翻译结果
const CACHE_KEY = 'vtt_translation_cache';
let translationCache = {};

// 初始化缓存
try {
    const cached = $persistentStore.read(CACHE_KEY);
    if (cached) translationCache = JSON.parse(cached);
} catch (e) {
    console.log('初始化缓存失败:', e);
}

// 保存缓存
function saveCache() {
    try {
        $persistentStore.write(JSON.stringify(translationCache), CACHE_KEY);
    } catch (e) {
        console.log('保存缓存失败:', e);
    }
}

// 从缓存获取翻译
function getCachedTranslation(text) {
    return translationCache[text];
}

// 设置翻译缓存
function setCachedTranslation(text, translation) {
    translationCache[text] = translation;
    // 限制缓存大小
    const keys = Object.keys(translationCache);
    if (keys.length > 1000) { // 最多保存1000条翻译
        delete translationCache[keys[0]];
    }
    saveCache();
}

// 翻译函数
async function translate(text) {
    return new Promise((resolve) => {
        // 检查是否为空或纯音效
        if (!text || text.trim() === "" || text.match(/^\[.*\]$/)) {
            resolve(text);
            return;
        }

        // 检查缓存
        const cached = getCachedTranslation(text);
        if (cached) {
            resolve(cached);
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
            timeout: 3000
        }, function(error, response, data) {
            if (error) {
                console.log(`翻译请求失败: ${error}`);
                resolve(text);
                return;
            }

            try {
                const result = JSON.parse(data);
                if (result?.[0]?.[0]?.[0]) {
                    const translation = result[0][0][0].trim();
                    // 缓存翻译结果
                    setCachedTranslation(text, translation);
                    resolve(translation);
                } else {
                    resolve(text);
                }
            } catch (e) {
                console.log(`翻译解析错误: ${e}`);
                resolve(text);
            }
        });
    });
}

// VTT解析器
class VTTParser {
    static parse(vttContent) {
        const lines = vttContent.split('\n');
        const blocks = [];
        let currentBlock = null;

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine === 'WEBVTT') continue;
            
            if (trimmedLine.match(/^\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}/)) {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = { timing: trimmedLine, content: [] };
            } else if (currentBlock) {
                currentBlock.content.push(trimmedLine);
            }
        }
        
        if (currentBlock) blocks.push(currentBlock);
        return blocks;
    }

    static async processBlocks(blocks) {
        let output = 'WEBVTT\n\n';
        let totalBlocks = blocks.length;
        let processedBlocks = 0;

        for (const block of blocks) {
            processedBlocks++;
            const text = block.content.join(' ').trim();
            
            if (!text) continue;

            output += block.timing + '\n';

            if (text.match(/^\[.*\]$/)) {
                output += text + '\n\n';
                continue;
            }

            const translation = await translate(text);
            console.log(`处理进度: ${processedBlocks}/${totalBlocks}`);
            
            output += text + '\n';
            if (translation && translation !== text) {
                output += translation + '\n';
            }
            output += '\n';
        }

        return output.trim();
    }
}

// 错误重试处理
async function withRetry(fn, retries = 2) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.log(`重试 ${i + 1}/${retries}: ${error}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    
    throw lastError;
}

// 主处理函数
async function processVTT() {
    try {
        if (!body.includes('WEBVTT')) {
            console.log('不是有效的VTT文件');
            return body;
        }

        const blocks = VTTParser.parse(body);
        if (!blocks.length) {
            console.log('未找到有效的字幕块');
            return body;
        }

        console.log(`开始处理 ${blocks.length} 个字幕块`);
        const result = await withRetry(() => VTTParser.processBlocks(blocks));
        console.log('字幕处理完成');
        return result;

    } catch (error) {
        console.log('处理出错:', error);
        return body;
    }
}

// 主流程
(async () => {
    try {
        if (url.includes('.vtt')) {
            const processed = await processVTT();
            $done({ body: processed });
        } else {
            $done({});
        }
    } catch (error) {
        console.log('主流程错误:', error);
        $done({});
    }
})();

// Surge/QuanX 环境补充
function Env(name) {
    this.name = name;
    this.logs = [];
    
    this.log = (...log) => {
        this.logs.push(`[${this.name}] ${log.join(' ')}`);
        console.log(`[${this.name}] ${log.join(' ')}`);
    };
    
    return this;
}
