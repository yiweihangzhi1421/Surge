/*
Tubi VTT Subtitle Handler
Made by 2024
*/

const url = $request.url;
const headers = $request.headers;
const MAX_RETRY = 3;
const TIMEOUT = 10000;

const default_settings = {
    type: "Google",
    sl: "auto",
    tl: "zh",
    line: "s",
    delay: 500,       // 减小延迟
    batch_size: 5     // 批处理大小
};

// 读取设置
let settings = $persistentStore.read('tubi_translate_settings');
settings = settings ? {...default_settings, ...JSON.parse(settings)} : default_settings;

// 全局计数器
let currentIndex = 0;
let processedBlocks = [];

// 翻译函数
async function translate(text, retryCount = 0) {
    if (!text?.trim()) return '';
    
    return new Promise((resolve, reject) => {
        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text.trim())}`,
            timeout: TIMEOUT
        };

        $httpClient.post(options, (error, response, data) => {
            if (error) {
                if (retryCount < MAX_RETRY) {
                    setTimeout(() => {
                        translate(text, retryCount + 1)
                            .then(resolve)
                            .catch(() => resolve(''));
                    }, 1000 * (retryCount + 1));
                } else {
                    resolve('');
                }
                return;
            }

            try {
                const result = JSON.parse(data);
                const translated = result.sentences?.map(s => s.trans).join('').trim();
                resolve(translated || '');
            } catch (e) {
                resolve('');
            }
        });
    });
}

// 处理字幕块
async function processBlock(block) {
    const lines = block.split('\n');
    const timing = lines.find(line => line.includes(' --> '));
    
    if (!timing) return block;

    const textLines = lines.slice(lines.indexOf(timing) + 1);
    const text = textLines.join(' ').trim();
    
    if (!text || text.length < 3) return block;
    
    // 跳过音效
    if (/^\s*[\[\(（][^\]）\)]+[\]\)）]\s*$/.test(text)) return block;

    try {
        const translated = await translate(text);
        if (!translated) return block;
        
        return timing + '\n' + 
            (settings.line === 's' ? 
                text + '\n' + translated : 
                translated + '\n' + text);
    } catch (e) {
        return block;
    }
}

// 批量处理函数
async function processBatch(blocks, start) {
    const results = [];
    const end = Math.min(start + settings.batch_size, blocks.length);
    
    for (let i = start; i < end; i++) {
        const result = await processBlock(blocks[i]);
        results.push(result);
    }
    
    return results;
}

// 主处理函数
async function processSubtitles(body) {
    try {
        // 预处理字幕
        body = body.replace(/^WEBVTT\n/, '').trim();
        const blocks = body.split('\n\n').filter(b => b.trim());
        const results = ['WEBVTT\n'];
        
        // 批量处理
        for (let i = 0; i < blocks.length; i += settings.batch_size) {
            const processedBatch = await processBatch(blocks, i);
            results.push(...processedBatch);
            results.push('');  // 块间空行
            
            // 延迟等待
            await new Promise(resolve => setTimeout(resolve, settings.delay));
        }
        
        return results.join('\n');
    } catch (e) {
        console.log('处理字幕错误:', e);
        return body;
    }
}

// 主函数
async function main() {
    if (!url.includes('.vtt')) {
        $done({});
        return;
    }

    // 获取原始字幕
    const options = {
        url: url,
        headers: headers,
        timeout: TIMEOUT
    };

    $httpClient.get(options, async (error, response, data) => {
        if (error) {
            console.log('获取字幕失败:', error);
            $done({});
            return;
        }

        try {
            const result = await processSubtitles(data);
            $done({
                body: result,
                headers: {
                    'Content-Type': 'text/vtt;charset=utf-8'
                }
            });
        } catch (e) {
            console.log('处理失败:', e);
            $done({body: data});
        }
    });
}

// 开始执行
main();
