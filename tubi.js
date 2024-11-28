/* 
Tubi 字幕翻译器 - iOS 优化版
专为 iPhone/iPad 设备优化的轻量级字幕翻译脚本
*/

const CONFIG = {
    // 目标语言设置为简体中文
    targetLang: 'zh-CN',
    // 针对 iOS 的请求头
    headers: {
        'User-Agent': 'AppleCoreMedia/1.0.0.21H16 (iPhone; CPU OS 17_7 like Mac OS X)',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        'Accept': '*/*'
    },
    // 翻译请求间隔（毫秒）
    requestDelay: 200
};

class TubiTranslator {
    constructor() {
        this.output = ['WEBVTT\n'];
        this.translateQueue = [];
    }

    async processSubtitle(body) {
        try {
            // 分割字幕块
            const blocks = body.split('\n\n');
            
            // 过滤出需要翻译的有效字幕
            this.translateQueue = blocks
                .map((block, index) => {
                    const lines = block.split('\n');
                    const timing = lines.find(l => l.includes(' --> '));
                    if (!timing) return { index, skip: true, content: block };
                    
                    const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
                    if (!text) return { index, skip: true, content: block };
                    
                    return {
                        index,
                        timing,
                        text,
                        skip: false
                    };
                });

            // 处理字幕队列
            for (const item of this.translateQueue) {
                if (item.skip) {
                    this.output[item.index] = item.content + '\n';
                    continue;
                }

                const translated = await this.translate(item.text).catch(() => '');
                this.output[item.index] = translated ? 
                    `${item.timing}\n${item.text}\n${translated}\n` :
                    `${item.timing}\n${item.text}\n`;

                // 添加延迟避免请求过快
                await new Promise(r => setTimeout(r, CONFIG.requestDelay));
            }

            return {
                body: this.output.join('\n'),
                headers: {
                    'Content-Type': 'text/vtt;charset=utf-8'
                }
            };
        } catch (e) {
            console.error('字幕处理错误:', e);
            return { body };
        }
    }

    async translate(text) {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: 'auto',
            tl: CONFIG.targetLang,
            dt: 't'
        });

        try {
            const response = await $httpClient.post({
                url: `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
                headers: CONFIG.headers,
                body: `q=${encodeURIComponent(text)}`
            });

            const data = JSON.parse(response.data);
            return data[0]?.map(s => s[0]).join('').trim();
        } catch (e) {
            console.error('翻译请求错误:', e);
            return '';
        }
    }
}

// 主程序入口
const url = $request.url;
if (!url.includes('.vtt')) {
    $done({});
} else {
    const translator = new TubiTranslator();
    translator
        .processSubtitle($response.body)
        .then(result => $done(result))
        .catch(() => $done({ body: $response.body }));
}
