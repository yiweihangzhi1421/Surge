/*
Tubi Subtitle Translator
Made by 2024
*/

const url = $request.url;
const default_settings = {
    type: "Google",
    sl: "auto",
    tl: "zh",
    line: "s",
    delay: 300,        // 增加延迟到300ms
    retries: 2,        // 翻译失败时重试次数
    backoff: 1000      // 重试间隔时间(ms)
};

// 读取设置
let settings = $persistentStore.read('tubi_translate_settings');
settings = settings ? {...default_settings, ...JSON.parse(settings)} : default_settings;

// 翻译函数（带重试）
async function translate(text, retryCount = 0) {
    if (!text?.trim()) return '';

    return new Promise((resolve) => {
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
                const translated = result.sentences?.map(s => s.trans).join('').trim() || '';
                if (translated) {
                    resolve(translated);
                } else if (retryCount < settings.retries) {
                    // 翻译失败，等待后重试
                    await new Promise(r => setTimeout(r, settings.backoff * (retryCount + 1)));
                    const retryResult = await translate(text, retryCount + 1);
                    resolve(retryResult);
                } else {
                    resolve('');
                }
            } catch (e) {
                if (retryCount < settings.retries) {
                    // 出错重试
                    setTimeout(async () => {
                        const retryResult = await translate(text, retryCount + 1);
                        resolve(retryResult);
                    }, settings.backoff * (retryCount + 1));
                } else {
                    resolve('');
                }
            }
        });
    });
}

// 加入翻译队列
const translationQueue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || translationQueue.length === 0) return;
    isProcessing = true;

    const {text, resolve, reject} = translationQueue.shift();
    try {
        const result = await translate(text);
        resolve(result);
    } catch (e) {
        reject(e);
    } finally {
        isProcessing = false;
        setTimeout(processQueue, settings.delay);
    }
}

function queueTranslation(text) {
    return new Promise((resolve, reject) => {
        translationQueue.push({text, resolve, reject});
        if (!isProcessing) processQueue();
    });
}

// 处理字幕块
async function processSubtitles(body) {
    try {
        const blocks = body.split('\n\n').filter(b => b.trim());
        const result = ['WEBVTT\n'];

        for (const block of blocks) {
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));

            if (!timing) {
                result.push(block, '');
                continue;
            }

            const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
            
            if (!text) {
                result.push(block, '');
                continue;
            }

            const translated = await queueTranslation(text);
            
            if (translated) {
                result.push(
                    timing,
                    settings.line === 's' ? text : translated,
                    settings.line === 's' ? translated : text,
                    ''
                );
            } else {
                result.push(block, '');
            }
        }

        $done({
            body: result.join('\n'),
            headers: {
                'Content-Type': 'text/vtt;charset=utf-8'
            }
        });
    } catch (e) {
        console.log('处理错误:', e);
        $done({});
    }
}

// 主函数
function main() {
    if (!url.includes('.vtt') || settings.type === "Disable") {
        $done({});
        return;
    }

    const body = $response.body?.replace(/^WEBVTT\n/, '').trim();
    if (!body) {
        $done({});
        return;
    }

    processSubtitles(body);
}

main();
