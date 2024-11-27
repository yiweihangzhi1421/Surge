/*
    Dualsub for Tubi (Surge) - 最小化版本
*/

const url = $request.url;

function translate(text) {
    return new Promise((resolve) => {
        // 使用最简单的翻译API
        const options = {
            url: `http://translate.google.cn/translate_a/single?client=gtx&dt=t&sl=auto&tl=zh&q=${encodeURIComponent(text)}`,
            headers: {
                'User-Agent': 'Mozilla/5.0',
            }
        };

        $httpClient.get(options, function(err, resp, data) {
            if (err) resolve('');
            try {
                const obj = JSON.parse(data);
                if (obj && obj[0] && obj[0][0] && obj[0][0][0]) {
                    resolve(obj[0][0][0]);
                } else {
                    resolve('');
                }
            } catch (e) {
                resolve('');
            }
        });
    });
}

async function processFirstBatch(body) {
    const header = "WEBVTT\n\n";
    const blocks = body.replace(/^WEBVTT\n/, '').trim().split('\n\n');
    
    // 只处理前5个块
    const firstBlocks = blocks.slice(0, 5);
    const translatedBlocks = [];

    try {
        for (const block of firstBlocks) {
            const lines = block.split('\n');
            const timing = lines.find(l => l.includes(' --> '));
            
            if (!timing) {
                translatedBlocks.push(block);
                continue;
            }

            const contentLines = lines.slice(lines.indexOf(timing) + 1);
            const text = contentLines.join(' ').trim();

            if (!text || text === '♪' || text.match(/^[.,!?，。！？\s]+$/)) {
                translatedBlocks.push(block);
                continue;
            }

            const translated = await translate(text);
            translatedBlocks.push(
                translated ? 
                `${timing}\n${text}\n${translated}` : 
                block
            );

            // 每次翻译后短暂等待
            await new Promise(r => setTimeout(r, 200));
        }

        return header + translatedBlocks.join('\n\n') + '\n';
    } catch {
        return body;
    }
}

// 主函数
if (url.includes('.vtt')) {
    processFirstBatch($response.body).then(result => {
        $done({ body: result });
    }).catch(() => {
        $done({});
    });
} else if (url.includes('.m3u8')) {
    $done({});
}
