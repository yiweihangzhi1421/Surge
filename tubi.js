const url = $request.url;
const MAX_RETRY = 2;
const RETRY_DELAY = 1000;
const MAX_CONCURRENT = 1;

let activeRequests = 0;
let settings = {
    sl: "auto",
    tl: "zh",
    line: "s"
};

// 简单的节流函数
async function throttle() {
    while (activeRequests >= MAX_CONCURRENT) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    activeRequests++;
}

// 简化的翻译请求
async function translate(text, retryCount = 0) {
    if (!text?.trim()) return '';
    
    await throttle();
    
    return new Promise((resolve) => {
        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text)}`
        };

        $httpClient.post(options, async function(error, response, data) {
            activeRequests--;
            
            if (error) {
                if (retryCount < MAX_RETRY) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    resolve(await translate(text, retryCount + 1));
                } else {
                    resolve('');
                }
                return;
            }

            try {
                const result = JSON.parse(data);
                const translated = result.sentences?.map(s => s.trans).join('').trim() || '';
                resolve(translated);
            } catch (e) {
                resolve('');
            }
        });
    });
}

// 简化的字幕处理
async function processSubtitles(body) {
    try {
        const lines = body.split('\n');
        let currentBlock = [];
        let translatedBody = ['WEBVTT\n'];
        let needTranslation = false;
        let timing = '';
        let text = '';

        for (let line of lines) {
            line = line.trim();
            
            // 跳过WEBVTT行
            if (line === 'WEBVTT') continue;
            
            // 时间轴行
            if (line.includes(' --> ')) {
                if (needTranslation && timing && text) {
                    const translated = await translate(text);
                    if (translated) {
                        translatedBody.push(timing);
                        if (settings.line === 's') {
                            translatedBody.push(text);
                            translatedBody.push(translated);
                        } else {
                            translatedBody.push(translated);
                            translatedBody.push(text);
                        }
                        translatedBody.push('');
                    }
                }
                timing = line;
                text = '';
                needTranslation = true;
                continue;
            }

            // 空行标志着块的结束
            if (!line) {
                continue;
            }

            // 字幕文本行
            if (needTranslation) {
                text += (text ? ' ' : '') + line;
            }
        }

        // 处理最后一块
        if (needTranslation && timing && text) {
            const translated = await translate(text);
            if (translated) {
                translatedBody.push(timing);
                if (settings.line === 's') {
                    translatedBody.push(text);
                    translatedBody.push(translated);
                } else {
                    translatedBody.push(translated);
                    translatedBody.push(text);
                }
            }
        }

        $done({
            body: translatedBody.join('\n'),
            headers: {
                'Content-Type': 'text/vtt;charset=utf-8'
            }
        });
    } catch (e) {
        console.log('处理失败:', e);
        $done({});
    }
}

if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else {
    $done({});
}
