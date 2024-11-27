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
    type: "Google",     // Google, DeepL, Disable
    sl: "auto",         // 源语言
    tl: "zh",          // 目标语言
    line: "s",         // s: 翻译在下, f: 翻译在上
    skip_brackets: false, // 改为false，不跳过括号内容
    translate_sound: true, // 是否翻译音效
    speaker_format: "prefix", // none, prefix, append - 说话者标记的显示方式
    dkey: "null"       // DeepL API Key
};

// 读取设置
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

function handleTranslationRequest(text, callback) {
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
    const dialogue = dialogueLines.join(' ').trim();

    // 检查是否为空或只有标点
    if (!dialogue || dialogue.match(/^[.,!?，。！？\s]+$/)) {
        translatedBlocks[index] = block;
        finishIfDone();
        return;
    }

    // 检查是否为音效描述
    const isSoundEffect = /^\s*[\[\(].*[\]\)]\s*$/.test(dialogue);
    
    if (isSoundEffect) {
        if (!settings.translate_sound) {
            translatedBlocks[index] = block;
            finishIfDone();
            return;
        }
        // 处理音效描述
        const textToTranslate = dialogue.replace(/[\[\(\)\]]/g, '').trim();
        handleTranslationRequest(textToTranslate, (translated) => {
            if (translated) {
                translatedBlocks[index] = `${timing}\n${dialogue}\n(${translated})`;
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
    } else {
        // 处理普通对话
        const speakerMatch = dialogue.match(/^([^:：]+)[:\s]/);
        const speaker = speakerMatch ? speakerMatch[1] : '';
        const text = speakerMatch ? dialogue.replace(/^[^:：]+[:：]\s*/, '') : dialogue;

        handleTranslationRequest(text, (translated) => {
            if (translated) {
                let translatedBlock = timing + '\n';
                if (speaker) {
                    switch (settings.speaker_format) {
                        case "prefix":
                            translatedBlock += `${speaker}: ${text}\n${speaker}: ${translated}`;
                            break;
                        case "append":
                            translatedBlock += `${text} (${speaker})\n${translated} (${speaker})`;
                            break;
                        default:
                            translatedBlock += `${dialogue}\n${translated}`;
                    }
                } else {
                    translatedBlock += `${dialogue}\n${translated}`;
                }
                translatedBlocks[index] = translatedBlock;
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
    }
}

function processSubtitles(body) {
    if (settings.type === "Disable" || !body) {
        $done({});
        return;
    }

    const header = "WEBVTT\n\n";
    body = body.replace(/^WEBVTT\n/, '');
    const subtitleBlocks = body.split('\n\n').filter(block => block.trim());
    const translatedBlocks = new Array(subtitleBlocks.length);
    let pendingTranslations = subtitleBlocks.length;

    const finishIfDone = () => {
        pendingTranslations--;
        if (pendingTranslations <= 0) {
            $done({ body: header + translatedBlocks.join('\n\n') });
        }
    };

    subtitleBlocks.forEach((block, index) => {
        processBlock(block, index, translatedBlocks, finishIfDone);
    });
}

// 主处理逻辑
if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
