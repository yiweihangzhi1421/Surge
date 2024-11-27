/*
    Dualsub for Tubi (Surge) - 简化版
*/
const url = $request.url;
const headers = $request.headers;
const default_settings = {
    type: "Google",     
    sl: "auto",         
    tl: "zh",          
    line: "s"
};

let settings = $persistentStore.read('tubi_settings');
if (!settings) {
    settings = default_settings;
    $persistentStore.write(JSON.stringify(settings), 'tubi_settings');
} else {
    settings = JSON.parse(settings);
}

function batchTranslate(texts) {
    return new Promise((resolve) => {
        if (texts.length === 0) {
            resolve([]);
            return;
        }
        
        // 将所有文本拼接起来，用特殊分隔符分隔
        const combinedText = texts.join('\n@@@\n');
        
        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `q=${encodeURIComponent(combinedText)}`
        };

        $httpClient.post(options, function(error, response, data) {
            if (error) {
                resolve(new Array(texts.length).fill(''));
                return;
            }
            try {
                const result = JSON.parse(data);
                if (result.sentences) {
                    const translated = result.sentences.map(s => s.trans).join('');
                    // 按分隔符分割回数组
                    const results = translated.split('@@@').map(t => t.trim());
                    resolve(results);
                } else {
                    resolve(new Array(texts.length).fill(''));
                }
            } catch (e) {
                resolve(new Array(texts.length).fill(''));
            }
        });
    });
}

async function processSubtitles(body) {
    if (!body) {
        $done({});
        return;
    }

    const header = "WEBVTT\n\n";
    body = body.replace(/^WEBVTT\n/, '').trim();
    
    // 分割字幕块
    const blocks = body.split('\n\n').filter(block => block.trim());
    const textsToTranslate = [];
    const timings = [];
    const processedBlocks = [];

    // 提取需要翻译的文本
    blocks.forEach(block => {
        const lines = block.split('\n');
        const timing = lines.find(line => line.includes(' --> '));
        if (!timing) {
            processedBlocks.push(block);
            return;
        }

        const textLines = lines.slice(lines.indexOf(timing) + 1);
        const text = textLines.join('\n').trim(); // 保持原始换行格式
        timings.push(timing);
        textsToTranslate.push(text);
    });

    // 分批翻译，每批20个字幕
    const batchSize = 20;
    const translatedTexts = [];
    
    for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        const batch = textsToTranslate.slice(i, i + batchSize);
        const translations = await batchTranslate(batch);
        translatedTexts.push(...translations);
    }

    // 重建字幕块
    for (let i = 0; i < textsToTranslate.length; i++) {
        if (translatedTexts[i]) {
            processedBlocks.push(`${timings[i]}\n${textsToTranslate[i]}\n${translatedTexts[i]}`);
        } else {
            processedBlocks.push(`${timings[i]}\n${textsToTranslate[i]}`);
        }
    }

    const result = header + processedBlocks.join('\n\n') + '\n';
    $done({ body: result });
}

if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
