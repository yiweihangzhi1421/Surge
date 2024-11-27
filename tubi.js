/*
Tubi Subtitle Translator
Made by 2024
*/

// 处理请求相关的变量
const url = $request.url;
const headers = $request.headers;

// 基础设置
const default_settings = {
    type: "Google",    // 翻译类型
    sl: "auto",        // 源语言
    tl: "zh",         // 目标语言
    line: "s",         // 显示顺序：s-原文在上，t-译文在上
    delay: 200        // 处理延迟(ms)
};

// 读取本地设置
let settings = $persistentStore.read('tubi_translate_settings');
settings = settings ? {...default_settings, ...JSON.parse(settings)} : default_settings;

// 翻译函数
function translate(text) {
    return new Promise((resolve) => {
        if (!text?.trim()) {
            resolve('');
            return;
        }

        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text.trim())}`
        };

        $httpClient.post(options, (error, response, data) => {
            try {
                if (error) throw error;
                const result = JSON.parse(data);
                resolve(result.sentences?.map(s => s.trans).join('').trim() || '');
            } catch (e) {
                console.log(`翻译错误: ${text}`);
                resolve('');
            }
        });
    });
}

// 格式化字幕块
function formatBlock(timing, original, translated) {
    if (settings.line === 's') {
        return `${timing}\n${original}\n${translated}`;
    }
    return `${timing}\n${translated}\n${original}`;
}

// 处理字幕
async function processSubtitles(body) {
    try {
        // 分割并过滤字幕块
        const blocks = body.split('\n\n').filter(b => b.trim());
        const result = ['WEBVTT\n'];
        let index = 0;

        // 处理单个字幕块
        async function processNext() {
            // 检查是否完成所有处理
            if (index >= blocks.length) {
                $done({
                    body: result.join('\n') + '\n',
                    headers: {
                        'Content-Type': 'text/vtt;charset=utf-8'
                    }
                });
                return;
            }

            // 获取当前块
            const block = blocks[index];
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));

            if (!timing) {
                // 不是标准字幕块，直接保留
                result.push(block);
            } else {
                // 获取文本内容
                const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
                
                if (text) {
                    const translated = await translate(text);
                    if (translated) {
                        // 添加翻译后的块
                        result.push(formatBlock(timing, text, translated));
                    } else {
                        // 翻译失败，保留原块
                        result.push(block);
                    }
                } else {
                    // 空文本，保留原块
                    result.push(block);
                }
            }
            
            // 添加块间空行
            result.push('');
            
            // 处理下一个块
            index++;
            setTimeout(processNext, settings.delay);
        }

        // 开始处理
        processNext();
    } catch (e) {
        console.log('处理错误:', e);
        $done({});
    }
}

// 主函数
function main() {
    // 只处理vtt字幕文件
    if (!url.includes('.vtt')) {
        $done({});
        return;
    }

    // 检查是否禁用翻译
    if (settings.type === "Disable") {
        $done({});
        return;
    }

    // 获取并清理字幕内容
    const body = $response.body?.replace(/^WEBVTT\n/, '').trim();
    if (!body) {
        $done({});
        return;
    }

    // 处理字幕
    processSubtitles(body);
}

// 运行脚本
main();
