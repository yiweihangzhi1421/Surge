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
    // 移除多余的冒号标记
    text = text.replace(/:\s*:/g, ':').trim();
    
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

    // 获取对话内容，保持原始格式
    const dialogueLines = lines.slice(lines.indexOf(timing) + 1);
    const dialogue = dialogueLines.join('\n').trim();

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
                // 保持原始格式，添加翻译
                translatedBlocks[index] = `${timing}\n${dialogue}\n(${translated})`;
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
    } else {
        // 处理普通对话，保持原始换行
        const dialogueToTranslate = dialogue.replace(/^([^:：]+)[:\s]:\s*/gm, '$1: ');
        handleTranslationRequest(dialogueToTranslate, (translated) => {
            if (translated) {
                // 构建翻译后的字幕块，保持原格式
                translatedBlocks[index] = `${timing}\n${dialogue}\n${translated}`;
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

    // 确保WEBVTT头部正确
    const header = "WEBVTT\n\n";
    body = body.replace(/^WEBVTT\n/, '').trim();
    
    // 分割并过滤字幕块
    const subtitleBlocks = body.split('\n\n').filter(block => block.trim());
    const translatedBlocks = new Array(subtitleBlocks.length);
    let pendingTranslations = subtitleBlocks.length;

    const finishIfDone = () => {
        pendingTranslations--;
        if (pendingTranslations <= 0) {
            // 确保块之间有正确的分隔
            const result = header + translatedBlocks.join('\n\n') + '\n';
            $done({ body: result });
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
