const url = $request.url;

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

let settings = $persistentStore.read('tubi_settings');
if (!settings) {
    settings = default_settings;
    $persistentStore.write(JSON.stringify(settings), 'tubi_settings');
} else {
    settings = JSON.parse(settings);
}

let requestQueue = [];
let activeRequests = 0;
const maxConcurrentRequests = 3; // 并发限制
const delayBetweenRequests = 500; // 请求间隔
const timeoutLimit = 8000; // 单任务超时时间

function addToQueue(task) {
    requestQueue.push(task);
    processQueue();
}

function processQueue() {
    while (activeRequests < maxConcurrentRequests && requestQueue.length > 0) {
        const task = requestQueue.shift();
        activeRequests++;
        task(() => {
            activeRequests--;
            setTimeout(processQueue, delayBetweenRequests);
        });
    }
}

function handleTranslationRequest(text, callback) {
    addToQueue((done) => {
        if (!text || text.match(/^[\s.,!?♪]+$/)) {
            console.log(`跳过无意义翻译: ${text}`);
            callback(null);
            done();
            return;
        }

        const options = {
            url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&sl=${settings.sl}&tl=${settings.tl}`,
            headers: { 'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)' },
            body: `q=${encodeURIComponent(text)}`
        };

        let timeout = setTimeout(() => {
            console.log(`请求超时: ${text}`);
            callback(null);
            done();
        }, timeoutLimit);

        $httpClient.post(options, (error, response, data) => {
            clearTimeout(timeout);
            if (error) {
                console.log(`翻译请求失败: ${text}`);
                callback(null);
            } else {
                try {
                    const result = JSON.parse(data);
                    if (result && result[0]) {
                        const translations = result[0].map((item) => item[0]).join(' ').trim();
                        callback(translations);
                    } else {
                        console.log(`翻译结果格式不符合预期: ${text}, 返回数据: ${data}`);
                        callback(null);
                    }
                } catch (e) {
                    console.log(`翻译结果解析失败: ${text}, 返回数据: ${data}`);
                    callback(null);
                }
            }
            done();
        });
    });
}

function processBlock(block, index, translatedBlocks, finishIfDone) {
    const lines = block.split('\n');
    const timing = lines.find((line) => line.includes(' --> '));

    if (!timing) {
        translatedBlocks[index] = block;
        finishIfDone();
        return;
    }

    const dialogueLines = lines.slice(lines.indexOf(timing) + 1);
    const dialogue = dialogueLines.join(' ').trim();
    const isSoundEffect = /^\s*[\[\(].*[\]\)]\s*$/.test(dialogue);

    const textToTranslate = isSoundEffect
        ? dialogue.replace(/[\[\(\)\]]/g, '').trim()
        : dialogue;

    handleTranslationRequest(textToTranslate, (translated) => {
        if (translated) {
            let newBlock = `${timing}\n${dialogue}`;
            if (isSoundEffect) {
                newBlock += `\n(${translated})`;
            } else {
                newBlock += `\n${translated}`;
            }
            translatedBlocks[index] = newBlock;
        } else {
            translatedBlocks[index] = block;
        }
        finishIfDone();
    });
}

function processSubtitles(body) {
    if (settings.type === "Disable" || !body) {
        $done({});
        return;
    }

    const header = "WEBVTT\n\n";
    body = body.replace(/^WEBVTT\n/, '');
    const subtitleBlocks = body.split('\n\n').filter((block) => block.trim());
    const translatedBlocks = new Array(subtitleBlocks.length);
    let pendingTranslations = subtitleBlocks.length;

    const finishIfDone = () => {
        pendingTranslations--;
        if (pendingTranslations <= 0) {
            $done({ body: header + translatedBlocks.join('\n\n') });
        }
    };

    subtitleBlocks.forEach((block, index) => {
        processBlock(block, index, translatedBlocks, finishIfDone);
    });
}

if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
