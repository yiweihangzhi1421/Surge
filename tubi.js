/*
    Dualsub for Tubi (Surge) - 支持对话和音效
    
    [Script]
    Tubi-Dualsub = type=http-response,pattern=^https?:\/\/s\.adrise\.tv\/.+\.(vtt|m3u8),requires-body=1,max-size=0,timeout=30,script-path=Tubi-Dualsub.js
    Tubi-Dualsub-Setting = type=http-request,pattern=^https?:\/\/setting\.adrise\.tv\/\?action=(g|s)et,requires-body=1,max-size=0,script-path=Tubi-Dualsub.js

    [MITM]
    hostname = %APPEND% *.adrise.tv
*/

const url = $request.url;
const headers = $request.headers;

const default_settings = {
    type: "Google",     
    sl: "auto",         
    tl: "zh",          
    line: "s",         
    skip_brackets: false,
    translate_sound: true,
    speaker_format: "prefix",
    dkey: "null",
    batch_size: 5      // 新增: 批量处理大小
};

let settings = $persistentStore.read('tubi_settings');
if (!settings) {
    settings = default_settings;
    $persistentStore.write(JSON.stringify(settings), 'tubi_settings');
} else {
    settings = JSON.parse(settings);
    if (settings.translate_sound === undefined) {
        settings.translate_sound = true;
        $persistentStore.write(JSON.stringify(settings), 'tubi_settings');
    }
}

// 新增: 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 修改: 翻译请求处理
async function handleTranslationRequest(text) {
    return new Promise((resolve) => {
        const cleanText = text.replace(/:\s*:/g, ':').trim();
        if (!cleanText) {
            resolve('');
            return;
        }

        const options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(cleanText)}`
        };

        $httpClient.post(options, function(error, response, data) {
            if (error) {
                resolve('');
                return;
            }
            try {
                const result = JSON.parse(data);
                if (result.sentences) {
                    const translated = result.sentences.map(s => s.trans).join('').trim();
                    resolve(translated);
                } else {
                    resolve('');
                }
            } catch (e) {
                resolve('');
            }
        });
    });
}

// 修改: 字幕块处理
async function processBlock(block) {
    const lines = block.split('\n');
    const timing = lines.find(line => line.includes(' --> '));
    
    if (!timing) {
        return block;
    }

    const dialogueLines = lines.slice(lines.indexOf(timing) + 1);
    const dialogue = dialogueLines.join('\n').trim();

    if (!dialogue || dialogue.match(/^[.,!?，。！？\s]+$/)) {
        return block;
    }

    // 处理说话者名字和对话
    let speakerMatch = dialogue.match(/^([^:：]+)[:\s]/);
    let textToTranslate = dialogue;
    let speaker = '';

    if (speakerMatch) {
        speaker = speakerMatch[1];
        textToTranslate = dialogue.substring(speakerMatch[0].length).trim();
    }

    // 音效特殊处理
    if (/^\([^)]+\)$/.test(dialogue) || /^\[[^\]]+\]$/.test(dialogue)) {
        if (!settings.translate_sound) {
            return block;
        }
        const soundText = dialogue.replace(/[\[\(\)\]]/g, '').trim();
        const translated = await handleTranslationRequest(soundText);
        return translated ? `${timing}\n${dialogue}\n(${translated})` : block;
    }

    const translated = await handleTranslationRequest(textToTranslate);
    if (!translated) {
        return block;
    }

    if (speaker) {
        return `${timing}\n${speaker}: ${textToTranslate}\n${speaker}: ${translated}`;
    } else {
        return `${timing}\n${dialogue}\n${translated}`;
    }
}

// 修改: 字幕处理主函数
async function processSubtitles(body) {
    if (settings.type === "Disable" || !body) {
        $done({});
        return;
    }

    const header = "WEBVTT\n\n";
    body = body.replace(/^WEBVTT\n/, '').trim();
    
    const subtitleBlocks = body.split('\n\n').filter(block => block.trim());
    const translatedBlocks = [];
    
    // 批量处理字幕块
    for (let i = 0; i < subtitleBlocks.length; i += settings.batch_size) {
        const batch = subtitleBlocks.slice(i, i + settings.batch_size);
        const batchPromises = batch.map(block => processBlock(block));
        
        try {
            const results = await Promise.all(batchPromises);
            translatedBlocks.push(...results);
            // 添加延迟以避免请求过快
            if (i + settings.batch_size < subtitleBlocks.length) {
                await delay(300);
            }
        } catch (error) {
            console.error('Error processing batch:', error);
        }
    }

    const result = header + translatedBlocks.join('\n\n') + '\n';
    $done({ body: result });
}

// 主处理逻辑
if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
