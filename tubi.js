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
    chunk_size: 10      // 分块处理大小
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
    }
    if (settings.chunk_size === undefined) {
        settings.chunk_size = 10;
    }
    $persistentStore.write(JSON.stringify(settings), 'tubi_settings');
}

// 简化的翻译请求函数
function handleTranslationRequest(text) {
    return new Promise((resolve) => {
        if (!text.trim()) {
            resolve('');
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
                console.log('翻译请求错误:', error);
                resolve('');
                return;
            }
            try {
                const result = JSON.parse(data);
                if (result.sentences) {
                    resolve(result.sentences.map(s => s.trans).join('').trim());
                } else {
                    resolve('');
                }
            } catch (e) {
                console.log('翻译解析错误:', e);
                resolve('');
            }
        });
    });
}

function formatSubtitleBlock(timing, originalText, translatedText) {
    return `${timing}\n${settings.line === 's' ? originalText : translatedText}\n${settings.line === 's' ? translatedText : originalText}`;
}

async function processBlock(block) {
    const lines = block.split('\n');
    const timing = lines.find(line => line.includes(' --> '));
    
    if (!timing) return block;

    const dialogueLines = lines.slice(lines.indexOf(timing) + 1);
    const dialogue = dialogueLines.join(' ').trim();

    if (!dialogue || dialogue.match(/^[.,!?，。！？\s]+$/)) return block;

    const cleanDialogue = dialogue.replace(/^(.*?):\s*\1:\s*/, '$1: ');
    const isSoundEffect = /^\s*[\[\(].*[\]\)]\s*$/.test(cleanDialogue);
    
    let textToTranslate = cleanDialogue;
    if (isSoundEffect && settings.translate_sound) {
        textToTranslate = cleanDialogue.replace(/[\[\(\)\]]/g, '').trim();
    }

    const translated = await handleTranslationRequest(textToTranslate);
    if (!translated) return block;

    if (isSoundEffect && settings.translate_sound) {
        return formatSubtitleBlock(timing, cleanDialogue, `(${translated})`);
    }
    return formatSubtitleBlock(timing, cleanDialogue, translated);
}

async function processChunk(blocks, startIndex) {
    const results = [];
    const endIndex = Math.min(startIndex + settings.chunk_size, blocks.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        const result = await processBlock(blocks[i]);
        results.push(result);
    }
    
    return results;
}

async function processSubtitles(body) {
    if (settings.type === "Disable" || !body) {
        $done({});
        return;
    }

    try {
        const header = "WEBVTT\n\n";
        body = body.replace(/^WEBVTT\n/, '').trim();
        const subtitleBlocks = body.split('\n\n').filter(block => block.trim());
        const translatedBlocks = [];

        // 分块处理字幕
        for (let i = 0; i < subtitleBlocks.length; i += settings.chunk_size) {
            const processedChunk = await processChunk(subtitleBlocks, i);
            translatedBlocks.push(...processedChunk);
            
            // 给系统一个短暂的喘息时间
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const finalBody = header + translatedBlocks.join('\n\n') + '\n';
        $done({ 
            body: finalBody,
            headers: {
                'Content-Type': 'text/vtt;charset=utf-8'
            }
        });
    } catch (e) {
        console.log('处理字幕时发生错误:', e);
        $done({});
    }
}

async function main() {
    if (url.includes('.vtt')) {
        await processSubtitles($response.body);
    } else if (url.includes('.m3u8')) {
        $done({});
    }
}

main();
