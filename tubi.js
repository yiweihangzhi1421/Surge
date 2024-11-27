/*
Tubi Subtitle Translator
Made by 2024
*/

const url = $request.url;
const settings = {
    sl: "auto",
    tl: "zh",
    delay: 800      // 非常保守的延迟设置
};

// 简化的翻译函数
function translate(text) {
    return new Promise((resolve) => {
        if (!text?.trim()) {
            resolve('');
            return;
        }

        $httpClient.post({
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text.trim())}`
        }, (error, response, data) => {
            try {
                if (error) throw error;
                const result = JSON.parse(data);
                resolve(result.sentences?.map(s => s.trans).join('').trim() || '');
            } catch (e) {
                resolve('');
            }
        });
    });
}

// 主处理函数
function processSubtitles(vttContent) {
    const processedBlocks = ['WEBVTT\n'];
    const blocks = vttContent.split('\n\n').filter(block => block.trim());
    let currentIndex = 0;

    function processNextBlock() {
        if (currentIndex >= blocks.length) {
            $done({
                body: processedBlocks.join('\n'),
                headers: {'Content-Type': 'text/vtt;charset=utf-8'}
            });
            return;
        }

        const block = blocks[currentIndex];
        const lines = block.split('\n');
        const timeIndex = lines.findIndex(line => line.includes(' --> '));

        if (timeIndex === -1) {
            processedBlocks.push(block + '\n');
            currentIndex++;
            setTimeout(processNextBlock, settings.delay);
            return;
        }

        const timing = lines[timeIndex];
        const text = lines.slice(timeIndex + 1).join(' ').trim();

        if (!text) {
            processedBlocks.push(block + '\n');
            currentIndex++;
            setTimeout(processNextBlock, settings.delay);
            return;
        }

        translate(text).then(translated => {
            if (translated) {
                processedBlocks.push(timing);
                processedBlocks.push(text);
                processedBlocks.push(translated);
                processedBlocks.push('');
            } else {
                processedBlocks.push(block + '\n');
            }
            currentIndex++;
            setTimeout(processNextBlock, settings.delay);
        });
    }

    processNextBlock();
}

// 入口函数
if (url.includes('.vtt')) {
    const body = $response.body?.replace(/^WEBVTT\n/, '').trim();
    if (body) {
        processSubtitles(body);
    } else {
        $done({});
    }
} else {
    $done({});
}
