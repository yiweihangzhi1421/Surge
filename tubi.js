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
    dkey: "null"
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

// 缓存已翻译的文本
const translationCache = new Map();

function handleTranslationRequest(text, callback) {
    // 检查缓存
    if (translationCache.has(text)) {
        callback(translationCache.get(text));
        return;
    }

    // 清理文本
    text = text.replace(/:\s*:/g, ':').trim();
    if (!text) {
        callback('');
        return;
    }

    const options = {
        url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
        headers: {
            'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
        },
        body: `q=${encodeURIComponent(text)}`
    };

    $httpClient.post(options, function(error, response, data) {
        if (error) {
            callback('');
            return;
        }
        try {
            const result = JSON.parse(data);
            if (result.sentences) {
                const translated = result.sentences.map(s => s.trans).join('').trim();
                // 存入缓存
                translationCache.set(text, translated);
                callback(translated);
            } else {
                callback('');
            }
        } catch (e) {
            callback('');
        }
    });
}

function processBlock(block, index, translatedBlocks, finishIfDone) {
    const lines = block.split('\n');
    const timing = lines.find(line => line.includes(' --> '));
    
    if (!timing) {
        translatedBlocks[index] = block;
        finishIfDone();
        return;
    }

    const dialogueLines = lines.slice(lines.indexOf(timing) + 1);
    const dialogue = dialogueLines.join('\n').trim();

    if (!dialogue || dialogue.match(/^[.,!?，。！？\s]+$/)) {
        translatedBlocks[index] = block;
        finishIfDone();
        return;
    }

    // 处理说话者名字和对话
    let speakerMatch = dialogue.match(/^([^:：]+)[:\s]/);
    let textToTranslate = dialogue;
    let speaker = '';

    if (speakerMatch) {
        speaker = speakerMatch[1];
        textToTranslate = dialogue.substring(speakerMatch[0].length).trim();
    }

    // 快速判断是否为音效
    const isSoundEffect = /^\([^)]+\)$/.test(dialogue) || /^\[[^\]]+\]$/.test(dialogue);
    
    if (isSoundEffect) {
        if (!settings.translate_sound) {
            translatedBlocks[index] = block;
            finishIfDone();
            return;
        }
        
        const soundText = dialogue.replace(/[\[\(\)\]]/g, '').trim();
        handleTranslationRequest(soundText, (translated) => {
            translatedBlocks[index] = translated ? 
                `${timing}\n${dialogue}\n(${translated})` : block;
            finishIfDone();
        });
        return;
    }

    handleTranslationRequest(textToTranslate, (translated) => {
        if (!translated) {
            translatedBlocks[index] = block;
        } else {
            if (speaker) {
                translatedBlocks[index] = `${timing}\n${speaker}: ${textToTranslate}\n${speaker}: ${translated}`;
            } else {
                translatedBlocks[index] = `${timing}\n${dialogue}\n${translated}`;
            }
        }
        finishIfDone();
    });
}

function processSubtitles(body) {
    if (settings.type === "Disable" || !body) {
        $done({});
        return;
    }

    const header = "WEBVTT\n\n";
    body = body.replace(/^WEBVTT\n/, '').trim();
    
    const subtitleBlocks = body.split('\n\n').filter(block => block.trim());
    const translatedBlocks = new Array(subtitleBlocks.length);
    let pendingTranslations = subtitleBlocks.length;
    
    // 创建批处理数组
    const batchSize = 3; // 每次处理3个字幕块
    const batches = [];
    
    for (let i = 0; i < subtitleBlocks.length; i += batchSize) {
        batches.push(subtitleBlocks.slice(i, i + batchSize));
    }

    let currentBatch = 0;

    const processNextBatch = () => {
        if (currentBatch >= batches.length) {
            return;
        }

        const batch = batches[currentBatch];
        batch.forEach((block, batchIndex) => {
            const globalIndex = currentBatch * batchSize + batchIndex;
            processBlock(block, globalIndex, translatedBlocks, () => {
                pendingTranslations--;
                if (pendingTranslations <= 0) {
                    const result = header + translatedBlocks.join('\n\n') + '\n';
                    $done({ body: result });
                }
            });
        });

        currentBatch++;
        if (currentBatch < batches.length) {
            setTimeout(processNextBatch, 100); // 100ms延迟处理下一批
        }
    };

    processNextBatch();
}

// 主处理逻辑
if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
