/*
    Dualsub for Tubi (Surge) - 直接翻译版
*/

const url = $request.url;

function translateText(text) {
    return new Promise((resolve) => {
        let options = {
            url: 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=zh',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };
        
        // 直接添加查询参数到URL，而不是作为body发送
        options.url += `&q=${encodeURIComponent(text)}`;

        $httpClient.get(options, function(err, resp, data) {
            if (err) {
                resolve('');
                return;
            }
            try {
                const obj = JSON.parse(data);
                const translated = obj[0].map(item => item[0]).join('');
                resolve(translated || '');
            } catch (e) {
                resolve('');
            }
        });
    });
}

async function processSubtitles(body) {
    if (!body) {
        $done({});
        return;
    }

    try {
        const header = "WEBVTT\n\n";
        body = body.replace(/^WEBVTT\n/, '').trim();
        
        const blocks = body.split('\n\n');
        const translatedBlocks = [];

        for (const block of blocks) {
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));
            
            if (!timing) {
                translatedBlocks.push(block);
                continue;
            }

            const dialogueLines = lines.slice(lines.indexOf(timing) + 1);
            const dialogue = dialogueLines.join(' ').trim();

            // 跳过空行和纯音乐符号
            if (!dialogue || dialogue === '♪') {
                translatedBlocks.push(block);
                continue;
            }

            const translated = await translateText(dialogue);
            if (translated) {
                translatedBlocks.push(`${timing}\n${dialogue}\n${translated}`);
            } else {
                translatedBlocks.push(block);
            }

            // 每次翻译后暂停100ms
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const result = header + translatedBlocks.join('\n\n') + '\n';
        $done({ body: result });
    } catch (error) {
        $done({}); // 出错时返回原字幕
    }
}

if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
