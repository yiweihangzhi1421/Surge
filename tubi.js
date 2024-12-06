/*
Name: Tubi VTT Translator (Dual Subtitle Version)
Version: 1.3.0
Author: Claude
Update: 2024-12-06
*/

let $ = {
    done: value => { $done(value) }
};

const API = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=zh-CN';

// 主逻辑
if (!$request.url.includes('.vtt')) {
    $.done({});
} else {
    Main();
}

async function Main() {
    try {
        const blocks = $response.body.split('\n\n');
        const result = ['WEBVTT\n'];

        const promises = blocks.map(async (block) => {
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));

            if (!timing || lines.length < 2) {
                return block + '\n';
            }

            const textIndex = lines.indexOf(timing) + 1;
            const text = lines.slice(textIndex).join(' ').trim();

            if (!text) {
                return block + '\n';
            }

            try {
                const translated = await translate(text);
                if (translated) {
                    console.log('[Translation]', text, '=>', translated); // 添加日志记录原文与译文
                    return `${timing}\n${text}\n${translated}\n`;
                } else {
                    return block + '\n';
                }
            } catch (e) {
                console.log('[Translation Error]', e);
                return block + '\n';
            }
        });

        const translatedBlocks = await Promise.all(promises);
        result.push(...translatedBlocks);

        $.done({
            body: result.join('\n'),
            headers: {'Content-Type': 'text/vtt;charset=utf-8'}
        });

    } catch (e) {
        console.log('[Main Error]', e);
        $.done({body: $response.body});
    }
}

// 翻译函数
function translate(text, retries = 3) {
    return new Promise((resolve) => {
        function attempt() {
            $httpClient.post({
                url: API,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': '*/*',
                    'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
                },
                body: `q=${encodeURIComponent(text)}`
            }, (err, _, data) => {
                if (err && retries > 0) {
                    console.log('[HTTP Error]', err);
                    retries--;
                    setTimeout(attempt, 1000); // Retry with delay of 1 second
                } else if (err) {
                    console.log('[HTTP Error - No retries left]', err); // 添加日志记录无重试次数剩余时的错误
                    resolve(''); // No retries left
                } else {
                    try {
                        const translated = JSON.parse(data)[0]
                            .map(item => item[0])
                            .join('')
                            .trim();
                        resolve(translated);
                    } catch (e) {
                        console.log('[Parse Error]', e, 'Raw data:', data); // 添加日志记录原始数据以调试解析错误
                        resolve('');
                    }
                }
            });
        }
        attempt();
    });
}
