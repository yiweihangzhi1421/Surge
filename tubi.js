let isProcessing = false;
const MAX_BLOCKS = 3; // 每次处理的最大字幕块数
const BATCH_DELAY = 200; // 批次间隔时间(ms)

// 基础设置
const default_settings = {
    type: "Google",    // 翻译类型
    sl: "auto",        // 源语言
    tl: "zh",         // 目标语言
    line: "s",         // s: 原文在上，翻译在下；t: 翻译在上，原文在下
    sound: true,      // 是否翻译音效
    speaker: false,    // 是否保留说话人标记
};

// 读取用户设置
let settings = $persistentStore.read('tubi_translate_settings');
settings = settings ? { ...default_settings, ...JSON.parse(settings) } : default_settings;

// 字幕文本预处理
function cleanText(text) {
    // 移除多余空白
    text = text.trim().replace(/\s+/g, ' ');
    // 移除HTML标签
    text = text.replace(/<[^>]+>/g, '');
    return text;
}

// 检查是否是音效文本
function isSoundEffect(text) {
    return /^\s*[\[\(（].*[\]\)）]\s*$/.test(text);
}

// 基础翻译功能
function translate(text) {
    if (!text?.trim()) return Promise.resolve('');
    
    text = cleanText(text);
    
    return new Promise((resolve) => {
        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text)}`
        };

        $httpClient.post(options, (error, response, data) => {
            if (error) {
                console.log(`翻译错误: ${error}`);
                resolve('');
                return;
            }
            try {
                const result = JSON.parse(data);
                const translated = result.sentences?.map(s => s.trans).join('').trim() || '';
                resolve(translated);
            } catch (e) {
                console.log(`解析错误: ${e}`);
                resolve('');
            }
        });
    });
}

// 格式化字幕块
function formatBlock(timing, original, translated) {
    const lines = [timing];
    
    if (settings.line === 's') {
        lines.push(original);
        lines.push(translated);
    } else {
        lines.push(translated);
        lines.push(original);
    }
    
    return lines.join('\n');
}

// 处理单个字幕块
async function processBlock(block) {
    const lines = block.split('\n');
    const timing = lines.find(line => line.includes(' --> '));
    
    if (!timing) return block;
    
    const textLines = lines.slice(lines.indexOf(timing) + 1);
    const text = cleanText(textLines.join(' '));
    
    if (!text) return block;

    // 处理音效
    if (isSoundEffect(text)) {
        if (!settings.sound) return block;
        const cleanedText = text.replace(/[\[\(（\]\)）]/g, '').trim();
        const translated = await translate(cleanedText);
        return translated ? formatBlock(timing, text, `(${translated})`) : block;
    }

    // 处理普通对话
    const translated = await translate(text);
    return translated ? formatBlock(timing, text, translated) : block;
}

// 主处理函数
function processSubtitles(body) {
    if (isProcessing) return;
    isProcessing = true;

    try {
        // 基础字幕文件验证
        if (!body || body.trim().length === 0) {
            console.log('空字幕文件');
            $done({});
            return;
        }

        const blocks = body.split('\n\n').filter(b => b.trim());
        let currentIndex = 0;
        let processedBlocks = [];
        
        function processNextChunk() {
            if (currentIndex >= blocks.length) {
                // 处理完成
                const finalBody = 'WEBVTT\n\n' + processedBlocks.join('\n\n') + '\n';
                $done({
                    body: finalBody,
                    headers: {
                        'Content-Type': 'text/vtt;charset=utf-8'
                    }
                });
                isProcessing = false;
                return;
            }

            // 获取当前批次要处理的块
            const endIndex = Math.min(currentIndex + MAX_BLOCKS, blocks.length);
            const currentBlocks = blocks.slice(currentIndex, endIndex);
            
            // 处理当前批次
            Promise.all(currentBlocks.map(processBlock))
                .then(results => {
                    processedBlocks.push(...results);
                    currentIndex = endIndex;
                    
                    // 延迟处理下一批
                    setTimeout(processNextChunk, BATCH_DELAY);
                })
                .catch(error => {
                    console.log(`批次处理错误: ${error}`);
                    // 出错时仍继续处理
                    currentIndex = endIndex;
                    setTimeout(processNextChunk, BATCH_DELAY * 2);
                });
        }

        // 开始处理第一批
        processNextChunk();
    } catch (e) {
        console.log(`处理失败: ${e}`);
        $done({});
        isProcessing = false;
    }
}

// 入口函数
function main() {
    const url = $request.url;
    
    if (!url.includes('.vtt')) {
        $done({});
        return;
    }
    
    if (settings.type === "Disable") {
        $done({});
        return;
    }
    
    const body = $response.body.replace(/^WEBVTT\n/, '').trim();
    processSubtitles(body);
}

// 运行脚本
main();
