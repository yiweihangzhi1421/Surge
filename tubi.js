/*
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
    if (!text.trim()) {
        callback('');
        return;
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${settings.sl}&tl=${settings.tl}&q=${encodedText}`;

    $httpClient.get({
        url: url,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    }, function(error, response, data) {
        if (error) {
            console.log(`翻译请求错误: ${JSON.stringify(error)}`);
            callback('');
            return;
        }

        try {
            const result = JSON.parse(data);
            if (result && result[0] && result[0][0]) {
                const translated = result[0][0][0];
                callback(translated);
            } else {
                console.log('翻译结果解析失败:', data);
                callback('');
            }
        } catch (e) {
            console.log('翻译解析错误:', e, '原始数据:', data);
            callback('');
        }
    });
}

function formatSubtitleBlock(timing, originalText, translatedText, speaker = '') {
    let formattedBlock = timing + '\n';
    
    if (speaker) {
        switch (settings.speaker_format) {
            case "prefix":
                if (settings.line === 's') {
                    formattedBlock += `${originalText}\n${translatedText}`;
                } else {
                    formattedBlock += `${translatedText}\n${originalText}`;
                }
                break;
            case "append":
                if (settings.line === 's') {
                    formattedBlock += `${originalText}\n${translatedText}`;
                } else {
                    formattedBlock += `${translatedText}\n${originalText}`;
                }
                break;
            default:
                if (settings.line === 's') {
                    formattedBlock += `${originalText}\n${translatedText}`;
                } else {
                    formattedBlock += `${translatedText}\n${originalText}`;
                }
        }
    } else {
        if (settings.line === 's') {
            formattedBlock += `${originalText}\n${translatedText}`;
        } else {
            formattedBlock += `${translatedText}\n${originalText}`;
        }
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

    // 移除重复的标记（如 "Text: Text:"）
    const cleanDialogue = dialogue.replace(/^(.*?):\s*\1:\s*/, '$1: ');
    
    // 检查是否为音效描述
    const isSoundEffect = /^\s*[\[\(].*[\]\)]\s*$/.test(cleanDialogue);
    
    if (isSoundEffect && settings.translate_sound) {
        const textToTranslate = cleanDialogue.replace(/[\[\(\)\]]/g, '').trim();
        handleTranslationRequest(textToTranslate, (translated) => {
            if (translated) {
                translatedBlocks[index] = formatSubtitleBlock(timing, cleanDialogue, `(${translated})`);
            } else {
                translatedBlocks[index] = block;
            }
            finishIfDone();
        });
    } else {
        // 处理普通对话
        const speakerMatch = cleanDialogue.match(/^([^:：]+)[:\s]/);
        let speaker = '';
        let textToTranslate = cleanDialogue;

        if (speakerMatch) {
            speaker = speakerMatch[1];
            textToTranslate = cleanDialogue.replace(/^[^:：]+[:：]\s*/, '');
        }

        handleTranslationRequest(textToTranslate, (translated) => {
            if (translated) {
                if (speaker) {
                    translatedBlocks[index] = formatSubtitleBlock(
                        timing,
                        `${speaker}: ${textToTranslate}`,
                        `${speaker}: ${translated}`
                    );
                } else {
                    translatedBlocks[index] = formatSubtitleBlock(
                        timing,
                        textToTranslate,
                        translated
                    );
                }
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

    try {
        const header = "WEBVTT\n\n";
        body = body.replace(/^WEBVTT\n/, '').trim();
        const subtitleBlocks = body.split('\n\n').filter(block => block.trim());
        const translatedBlocks = new Array(subtitleBlocks.length);
        let pendingTranslations = subtitleBlocks.length;

        const finishIfDone = () => {
            pendingTranslations--;
            if (pendingTranslations <= 0) {
                const finalBody = header + translatedBlocks.join('\n\n') + '\n';
                $done({ 
                    body: finalBody,
                    headers: {
                        'Content-Type': 'text/vtt;charset=utf-8'
                    }
                });
            }
        };

        subtitleBlocks.forEach((block, index) => {
            processBlock(block, index, translatedBlocks, finishIfDone);
        });
    } catch (e) {
        console.log('处理字幕时发生错误:', e);
        $done({});
    }
}

function main() {
    if (url.includes('.vtt')) {
        processSubtitles($response.body);
    } else if (url.includes('.m3u8')) {
        $done({});
    }
}

main();
