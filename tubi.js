/*
Tubi Subtitle Translator
Made by 2024
*/

const url = $request.url;
// 基础设置
const SOUND_EFFECTS = new Set(['(laughter)', '(gasps)', '(groaning)', '(sighs)', '(chuckles)', 
    '(screaming)', '(grunts)', '(whistling)', '(coughs)', '(sniffles)', '(sobbing)', 
    '(panting)', '(clicks)', '(beeping)', '(buzzing)', '(hisses)', '(whirring)']);

// 预处理文本
function preProcess(text) {
    // 如果是常见音效，直接返回
    if (SOUND_EFFECTS.has(text.toLowerCase().trim())) {
        return text;
    }
    // 清理文本
    return text.trim();
}

// 合并短文本
function combineShortTexts(texts) {
    const result = [];
    let current = '';
    let originalIndexes = [];
    
    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (text.length < 5 || SOUND_EFFECTS.has(text.toLowerCase().trim())) {
            if (current) {
                result.push(current);
                originalIndexes.push([i - originalIndexes.length]);
            }
            result.push(text);
            originalIndexes.push([i]);
            current = '';
        } else {
            if (current) current += ' ||| ';
            current += text;
            if (!originalIndexes[result.length]) {
                originalIndexes[result.length] = [];
            }
            originalIndexes[result.length].push(i);
        }
    }
    if (current) {
        result.push(current);
    }
    return { combined: result, indexes: originalIndexes };
}

// 翻译函数
function translate(text) {
    return new Promise((resolve) => {
        // 如果是音效或极短文本，直接返回
        if (SOUND_EFFECTS.has(text.toLowerCase().trim()) || text.length < 5) {
            resolve(text);
            return;
        }

        $httpClient.post({
            url: 'https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=auto&tl=zh',
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text)}`
        }, (error, response, data) => {
            try {
                if (error) throw error;
                const result = JSON.parse(data);
                const translated = result.sentences?.map(s => s.trans).join('').trim();
                resolve(translated || text);
            } catch (e) {
                resolve(text);
            }
        });
    });
}

// 处理字幕
function processSubtitles(body) {
    try {
        const blocks = body.split('\n\n').filter(b => b.trim());
        const texts = [];
        const timings = [];
        
        // 提取所有文本和时间戳
        blocks.forEach(block => {
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));
            if (timing) {
                const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
                if (text) {
                    texts.push(preProcess(text));
                    timings.push(timing);
                }
            }
        });

        // 合并短文本
        const { combined, indexes } = combineShortTexts(texts);
        let currentIndex = 0;
        const translations = new Array(texts.length).fill('');

        function processBatch() {
            if (currentIndex >= combined.length) {
                // 完成所有翻译，组装最终字幕
                const result = ['WEBVTT\n'];
                for (let i = 0; i < texts.length; i++) {
                    result.push(timings[i]);
                    result.push(texts[i]);
                    if (translations[i]) {
                        result.push(translations[i]);
                    }
                    result.push('');
                }
                
                $done({
                    body: result.join('\n'),
                    headers: {'Content-Type': 'text/vtt;charset=utf-8'}
                });
                return;
            }

            translate(combined[currentIndex]).then(translated => {
                // 处理合并文本的翻译结果
                if (combined[currentIndex].includes(' ||| ')) {
                    const parts = translated.split(' ||| ');
                    indexes[currentIndex].forEach((idx, i) => {
                        translations[idx] = parts[i] || texts[idx];
                    });
                } else {
                    indexes[currentIndex].forEach(idx => {
                        translations[idx] = translated;
                    });
                }
                
                currentIndex++;
                setTimeout(processBatch, 800); // 800ms延迟
            });
        }

        processBatch();
    } catch (e) {
        console.log('处理错误:', e);
        $done({});
    }
}

// 主入口
if (url.includes('.vtt')) {
    const body = $response.body?.replace(/^WEBVTT\n/, '').trim();
    if (body) {
        processSubtitles(body);
    } else {
        $done({});
    }
} else {
    $done({});
}
