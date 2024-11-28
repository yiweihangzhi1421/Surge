/*
Name: Tubi VTT Translator
Version: 1.0.0
Author: Claude
Update: 2024-03-21
*/

let $ = {
    done: value => { $done(value) }
};

const DELAY = 100;
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
        let index = 0;

        async function processBlocks() {
            if (index >= blocks.length) {
                $.done({
                    body: result.join('\n'),
                    headers: {'Content-Type': 'text/vtt;charset=utf-8'}
                });
                return;
            }

            const block = blocks[index];
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));

            if (!timing || lines.length < 2) {
                result.push(block + '\n');
                index++;
                setTimeout(processBlocks, DELAY);
                return;
            }

            const textIndex = lines.indexOf(timing) + 1;
            const text = lines.slice(textIndex).join(' ').trim();

            if (!text) {
                result.push(block + '\n');
                index++;
                setTimeout(processBlocks, DELAY);
                return;
            }

            try {
                const translated = await translate(text);
                if (translated) {
                    result.push(`${timing}\n${text}\n${translated}\n`);
                } else {
                    result.push(block + '\n');
                }
            } catch (e) {
                console.log('[Translation Error]', e);
                result.push(block + '\n');
            }

            index++;
            setTimeout(processBlocks, DELAY);
        }

        // 开始处理
        processBlocks();

    } catch (e) {
        console.log('[Main Error]', e);
        $.done({body: $response.body});
    }
}

// 翻译函数
function translate(text) {
    return new Promise((resolve) => {
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
            if (err) {
                console.log('[HTTP Error]', err);
                resolve('');
                return;
            }

            try {
                const translated = JSON.parse(data)[0]
                    .map(item => item[0])
                    .join('')
                    .trim();
                resolve(translated);
            } catch (e) {
                console.log('[Parse Error]', e);
                resolve('');
            }
        });
    });
}
