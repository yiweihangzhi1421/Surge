/*
    Dualsub for Tubi (Surge)
    
    [Script]
    Tubi-Dualsub = type=http-response,pattern=^https?:\/\/s\.adrise\.tv\/.+\.(vtt|m3u8),requires-body=1,max-size=0,timeout=30,script-path=Tubi-Dualsub.js
    Tubi-Dualsub-Setting = type=http-request,pattern=^https?:\/\/setting\.adrise\.tv\/\?action=(g|s)et,requires-body=1,max-size=0,script-path=Tubi-Dualsub.js

    [MITM]
    hostname = %APPEND% *.adrise.tv
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    type: "Google",     // Google, DeepL, Disable
    sl: "auto",         // 源语言
    tl: "zh",          // 目标语言
    line: "s",         // s: 翻译在下, f: 翻译在上
    skip_brackets: true, // 跳过方括号/圆括号中的内容
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
}

async function processSubtitles(body) {
    try {
        // 分离WEBVTT头部
        let header = "WEBVTT\n\n";
        body = body.replace(/^WEBVTT\n/, '');

        // 预处理每个字幕块
        let subtitleBlocks = body.split('\n\n').filter(block => block.trim());
        let translatedBlocks = [];

        for (let block of subtitleBlocks) {
            let lines = block.split('\n');
            let timing = lines.find(line => line.includes(' --> '));
            
            if (!timing) continue;

            // 提取对话内容
            let dialogueLines = lines.slice(lines.indexOf(timing) + 1);
            let dialogue = dialogueLines.join(' ');

            // 处理说话者标记
            let speaker = '';
            let text = dialogue;
            
            // 提取圆括号或方括号中的说话者/音效
            let bracketMatch = dialogue.match(/^\s*[\[\(]([^\]\)]+)[\]\)]\s*/);
            if (bracketMatch) {
                if (settings.skip_brackets) {
                    speaker = bracketMatch[1];
                    text = dialogue.replace(/^\s*[\[\(][^\]\)]+[\]\)]\s*/, '');
                }
            } else {
                // 检查常见的说话者格式
                let speakerMatch = dialogue.match(/^([^:：]+)[:\s]/);
                if (speakerMatch) {
                    speaker = speakerMatch[1];
                    text = dialogue.replace(/^[^:：]+[:：]\s*/, '');
                }
            }

            // 如果文本为空或只包含标点符号，跳过翻译
            if (!text.trim() || text.trim().match(/^[.,!?，。！？\s]+$/)) {
                translatedBlocks.push(block);
                continue;
            }

            // 翻译文本
            let translated = '';
            if (settings.type === "Google") {
                let options = {
                    url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
                    headers: {
                        'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
                    },
                    body: `q=${encodeURIComponent(text)}`
                };

                let response = await $httpClient.post(options);
                let result = JSON.parse(response.body);
                
                if (result.sentences) {
                    translated = result.sentences.map(s => s.trans).join('').trim();
                }
            }

            // 构建双语字幕
            if (translated) {
                let translatedBlock = timing + '\n';
                
                // 根据设置处理说话者标记
                if (speaker) {
                    switch (settings.speaker_format) {
                        case "prefix":
                            translatedBlock += `${speaker}: ${dialogue}\n`;
                            translatedBlock += `${speaker}: ${translated}`;
                            break;
                        case "append":
                            translatedBlock += `${dialogue} (${speaker})\n`;
                            translatedBlock += `${translated} (${speaker})`;
                            break;
                        default:
                            translatedBlock += dialogue + '\n' + translated;
                    }
                } else {
                    translatedBlock += dialogue + '\n' + translated;
                }
                
                translatedBlocks.push(translatedBlock);
            } else {
                translatedBlocks.push(block);
            }
        }

        return header + translatedBlocks.join('\n\n');
    } catch (e) {
        console.log(`Error processing subtitles: ${e}`);
        return body;
    }
}

if (url.includes('.vtt')) {
    let body = $response.body;
    
    if (settings.type === "Disable" || !body) {
        $done({});
        return;
    }

    processSubtitles(body).then(processed_body => {
        $done({ body: processed_body });
    });
} else if (url.includes('.m3u8')) {
    $done({});
}
