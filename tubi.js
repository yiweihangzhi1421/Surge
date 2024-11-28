/*
Tubi VTT Subtitle Handler
Made by 2024
*/

const url = $request.url;
const default_settings = {
    type: "Google",
    sl: "auto",
    tl: "zh",
    line: "s",
    delay: 1000,
    retries: 2,
    sound: true,
    speaker: true
};

// 读取设置
let settings = $persistentStore.read('tubi_translate_settings');
settings = settings ? {...default_settings, ...JSON.parse(settings)} : default_settings;

// 常见音效列表
const SOUND_EFFECTS = new Set([
    "(laughter)", "(laughing)", "(laughs)",
    "(gasps)", "(gasping)", "(gasp)",
    "(groans)", "(groaning)", "(groan)",
    "(sighs)", "(sighing)", "(sigh)",
    "(chuckles)", "(chuckling)", "(chuckle)",
    "(screams)", "(screaming)", "(scream)",
    "(crying)", "(sobbing)", "(sniffling)",
    "(whispers)", "(whispering)", "(whisper)",
    "(music)", "(upbeat music)", "(dramatic music)",
]);

// 翻译请求函数
async function translateText(text, retryCount = 0) {
    return new Promise((resolve) => {
        if (!text?.trim()) {
            resolve('');
            return;
        }

        // 跳过音效翻译
        if (!settings.sound && SOUND_EFFECTS.has(text.toLowerCase().trim())) {
            resolve(text);
            return;
        }

        // 翻译请求
        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text.trim())}`
        };

        $httpClient.post(options, async (error, response, data) => {
            try {
                if (error) throw error;
                const result = JSON.parse(data);
                const translated = result.sentences?.map(s => s.trans).join('').trim();
                if (translated) {
                    resolve(translated);
                } else if (retryCount < settings.retries) {
                    // 翻译失败重试
                    await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
                    const retryResult = await translateText(text, retryCount + 1);
                    resolve(retryResult);
                } else {
                    resolve('');
                }
            } catch (e) {
                console.log('翻译错误:', e);
                if (retryCount < settings.retries) {
                    setTimeout(async () => {
                        const retryResult = await translateText(text, retryCount + 1);
                        resolve(retryResult);
                    }, 500 * (retryCount + 1));
                } else {
                    resolve('');
                }
            }
        });
    });
}

// 格式化字幕块
function formatSubtitle(timing, text, translation) {
    if (!translation) return `${timing}\n${text}`;
    return settings.line === 's' ? 
        `${timing}\n${text}\n${translation}` : 
        `${timing}\n${translation}\n${text}`;
}

// 处理单个字幕块
async function processBlock(block) {
    try {
        const lines = block.split('\n');
        const timing = lines.find(line => line.includes(' --> '));
        
        if (!timing) return block;

        // 获取文本内容
        const textLines = lines.slice(lines.indexOf(timing) + 1);
        let text = textLines.join(' ').trim();
        
        // 基础检查
        if (!text || text.length < 3) return block;

        // 音效检查
        if (!settings.sound && /^\s*[\[\(（][^\]）\)]+[\]\)）]\s*$/.test(text)) {
            return block;
        }

        // 提取说话人
        let speaker = '';
        if (settings.speaker) {
            const speakerMatch = text.match(/^([^:：]+)[:：]\s*/);
            if (speakerMatch) {
                speaker = speakerMatch[1];
                text = text.substring(speakerMatch[0].length);
            }
        }

        // 翻译文本
        const translated = await translateText(text);
        if (!translated) return block;

        // 组合最终字幕
        const finalTranslation = speaker ? 
            `${speaker}: ${translated}` : 
            translated;

        return formatSubtitle(timing, textLines.join('\n'), finalTranslation);
    } catch (e) {
        console.log('处理字幕块错误:', e);
        return block;
    }
}

// 主处理函数
async function processSubtitles(body) {
    if (!body) return '';

    try {
        // 分割并过滤字幕块
        const header = "WEBVTT\n\n";
        body = body.replace(/^WEBVTT\n/, '').trim();
        const blocks = body.split('\n\n').filter(b => b.trim());
        const result = [header];

        // 依次处理每个字幕块
        for (let block of blocks) {
            const processed = await processBlock(block);
            if (processed) {
                result.push(processed + '\n');
            }
            // 处理间隔
            await new Promise(resolve => setTimeout(resolve, settings.delay));
        }

        return result.join('\n');
    } catch (e) {
        console.log('处理字幕发生错误:', e);
        return body;
    }
}

// 入口函数
function main() {
    if (!url.includes('.vtt')) {
        $done({});
        return;
    }

    // 获取字幕内容
    $httpClient.get(url, async (error, response, body) => {
        if (error) {
            console.log('获取字幕失败:', error);
            $done({});
            return;
        }

        try {
            // 处理字幕
            const translatedBody = await processSubtitles(body);

            $done({
                body: translatedBody,
                headers: {
                    'Content-Type': 'text/vtt;charset=utf-8'
                }
            });
        } catch (e) {
            console.log('处理字幕内容失败:', e);
            $done({body});
        }
    });
}

// 启动脚本
main();
