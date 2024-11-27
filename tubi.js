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

// Read settings
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
    if (!text.trim()) {
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
                callback(translated);
            } else {
                callback('');
            }
        } catch (e) {
            callback('');
        }
    });
}

function formatSubtitleBlock(timing, originalText, translatedText, speaker = '') {
    let formattedBlock = timing + '\n';
    
    if (speaker) {
        switch (settings.speaker_format) {
            case "prefix":
                formattedBlock += `${speaker}: ${originalText}\n${speaker}: ${translatedText}`;
                break;
            case "append":
                formattedBlock += `${originalText} (${speaker})\n${translatedText} (${speaker})`;
                break;
            default:
                formattedBlock += `${originalText}\n${translatedText}`;
        }
    } else {
        formattedBlock += `${originalText}\n${translatedText}`;
    }
    
    return formattedBlock;
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

    if (!dialogue || dialogue.match(/^[.,!?，。！？\s]+$/)) {
        translatedBlocks[index] = block;
        finishIfDone();
        return;
    }

    const isSoundEffect = /^\s*[\[\(].*[\]\)]\s*$/.test(dialogue);
    
    if (isSoundEffect && settings.translate_sound) {
        const textToTranslate = dialogue.replace(/[\[\(\)\]]/g, '').trim();
        handleTranslationRequest(textToTranslate, (translated) => {
            if (translated) {
                translatedBlocks[index] = formatSubtitleBlock(timing, dialogue, `(${translated})`);
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
    } else if (!isSoundEffect) {
        const speakerMatch = dialogue.match(/^([^:：]+)[:\s]/);
        const speaker = speakerMatch ? speakerMatch[1] : '';
        const text = speakerMatch ? dialogue.replace(/^[^:：]+[:：]\s*/, '') : dialogue;

        handleTranslationRequest(text, (translated) => {
            if (translated) {
                translatedBlocks[index] = formatSubtitleBlock(timing, text, translated, speaker);
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
    } else {
        translatedBlocks[index] = block;
        finishIfDone();
    }
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
            const finalBody = header + translatedBlocks.join('\n\n') + '\n';
            $done({ body: finalBody });
        }
    };

    subtitleBlocks.forEach((block, index) => {
        processBlock(block, index, translatedBlocks, finishIfDone);
    });
}

if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
