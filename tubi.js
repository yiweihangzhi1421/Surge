/*
    Dualsub for Tubi (Surge) - 支持对话和音效 (稳定版)
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
}

function handleTranslationRequest(text, callback) {
    const options = {
        url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}&q=${encodeURIComponent(text)}`,
        headers: {
            'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
        }
    };

    $httpClient.get(options, function(error, response, data) {
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
    const dialogue = dialogueLines.join('\n').trim();

    if (!dialogue || dialogue.match(/^[.,!?，。！？\s]+$/)) {
        translatedBlocks[index] = block;
        finishIfDone();
        return;
    }

    // 处理说话者名字和对话
    let speakerMatch = dialogue.match(/^([A-Z]+):\s/);
    let textToTranslate = dialogue;
    let speaker = '';

    if (speakerMatch) {
        speaker = speakerMatch[1];
        textToTranslate = dialogue.substring(speakerMatch[0].length).trim();
    }

    // 处理音效
    if (/^\([^)]+\)$/.test(dialogue)) {
        if (!settings.translate_sound) {
            translatedBlocks[index] = block;
            finishIfDone();
            return;
        }
        const soundText = dialogue.slice(1, -1).trim();
        handleTranslationRequest(soundText, (translated) => {
            if (translated) {
                translatedBlocks[index] = `${timing}\n${dialogue}\n(${translated})`;
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
        return;
    }

    // 处理普通对话
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
    
    const finishIfDone = () => {
        pendingTranslations--;
        if (pendingTranslations <= 0) {
            const result = header + translatedBlocks.join('\n\n') + '\n';
            $done({ body: result });
        }
    };

    subtitleBlocks.forEach((block, index) => {
        setTimeout(() => {
            processBlock(block, index, translatedBlocks, finishIfDone);
        }, index * 50); // 每个请求间隔50ms
    });
}

// 主处理逻辑
if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
