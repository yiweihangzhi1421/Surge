/*
Lightweight Tubi Translator
极简版本，专注快速响应
*/

// 请求信息
const url = $request.url;
const body = $response.body;

// 主函数
if (!url.includes('.vtt')) {
    $done({});
} else {
    try {
        const blocks = body.split('\n\n');
        const result = ['WEBVTT\n'];
        let index = 0;

        function translateBlock() {
            if (index >= blocks.length) {
                $done({
                    body: result.join('\n'),
                    headers: {'Content-Type': 'text/vtt;charset=utf-8'}
                });
                return;
            }

            const block = blocks[index];
            const lines = block.split('\n');
            const timing = lines.find(line => line.includes(' --> '));

            if (!timing) {
                result.push(block + '\n');
                index++;
                setTimeout(translateBlock, 100);
                return;
            }

            const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
            if (!text) {
                result.push(block + '\n');
                index++;
                setTimeout(translateBlock, 100);
                return;
            }

            $httpClient.post({
                url: 'https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=auto&tl=zh',
                headers: {
                    'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
                },
                body: `q=${encodeURIComponent(text)}`
            }, (error, response, data) => {
                try {
                    if (error) throw error;
                    const translated = JSON.parse(data).sentences?.map(s => s.trans).join('').trim();
                    if (translated) {
                        result.push(`${timing}\n${text}\n${translated}\n`);
                    } else {
                        result.push(block + '\n');
                    }
                } catch (e) {
                    result.push(block + '\n');
                }
                
                index++;
                setTimeout(translateBlock, 200);
            });
        }

        // 开始处理
        translateBlock();

    } catch (e) {
        $done({body});
    }
}
