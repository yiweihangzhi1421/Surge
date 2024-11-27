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
        const combinedText = texts.join('\n###\n');
        
        const options = {
            url: `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${settings.sl}&tl=${settings.tl}&q=${encodeURIComponent(combinedText)}`,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        $httpClient.get(options, function(error, response, data) {
            if (error) {
                resolve(new Array(texts.length).fill(''));
                return;
            }
            try {
                const parsed = JSON.parse(data);
                const translated = parsed[0].map(item => item[0]).join('');
                // 按分隔符分割回数组
                const results = translated.split('###').map(t => t.trim());
                resolve(results);
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

        const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
        timings.push(timing);
        textsToTranslate.push(text);
    });

    // 批量翻译
    const translations = await batchTranslate(textsToTranslate);

    // 重建字幕块
    for (let i = 0; i < textsToTranslate.length; i++) {
        if (translations[i]) {
            processedBlocks.push(`${timings[i]}\n${textsToTranslate[i]}\n${translations[i]}`);
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
