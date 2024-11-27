/*
Dualsub for Tubi (Surge) - 支持对话和音效

[Script]
Tubi-Dualsub = type=http-response,pattern=^https?:\/\/s\.adrise\.tv\/.+\.(vtt|m3u8),requires-body=1,max-size=0,timeout=30,script-path=Tubi-Dualsub.js
Tubi-Dualsub-Setting = type=http-request,pattern=^https?:\/\/setting\.adrise\.tv\/\?action=(g|s)et,requires-body=1,max-size=0,script-path=Tubi-Dualsub.js

[MITM]
hostname = %APPEND% *.adrise.tv
*/

const url = $request.url;

const default_settings = {
    type: "Google",     // Google, DeepL, Disable
    sl: "auto",         // 源语言
    tl: "zh",           // 目标语言
    line: "s",          // s: 翻译在下, f: 翻译在上
    skip_brackets: false, // 改为false，不跳过括号内容
    translate_sound: true, // 是否翻译音效
    speaker_format: "prefix", // none, prefix, append
    dkey: "null"        // DeepL API Key
};

let settings = $persistentStore.read('tubi_settings');
if (!settings) {
    settings = default_settings;
    $persistentStore.write(JSON.stringify(settings), 'tubi_settings');
} else {
    settings = JSON.parse(settings);
}

let requestQueue = [];
let isProcessing = false;
const maxConcurrentRequests = 1; // 并发限制
const delayBetweenRequests = 500; // 请求间隔
const timeoutLimit = 10000; // 单字幕块处理超时（10秒）

function addToQueue(task) {
    requestQueue.push(task);
    if (!isProcessing) {
        processQueue();
    }
}

function processQueue() {
    if (requestQueue.length === 0) {
        isProcessing = false;
        return;
    }
    isProcessing = true;

    const task = requestQueue.shift();
    task(() => {
        setTimeout(() => {
            processQueue();
        }, delayBetweenRequests);
    });
}

function handleTranslationRequest(text, callback) {
    addToQueue((done) => {
        if (!text || text.match(/^[\s.,!?♪]+$/)) {
            console.log(`跳过翻译无意义内容: ${text}`);
            callback(null);
            done();
            return;
        }

        const options = {
            url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&sl=${settings.sl}&tl=${settings.tl}`,
            headers: { 'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)' },
            body: `q=${encodeURIComponent(text)}`
        };

        $httpClient.post(options, (error, response, data) => {
            if (error) {
                console.log(`翻译请求失败: ${text}`);
                callback(null);
            } else {
                try {
                    const result = JSON.parse(data);
                    const translations = result.sentences.map((s) => s.trans.trim());
                    callback(translations.join(' '));
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

    const timeout = setTimeout(() => {
        console.log(`翻译超时: ${textToTranslate}`);
        translatedBlocks[index] = block;
        finishIfDone();
    }, timeoutLimit);

    handleTranslationRequest(textToTranslate, (translated) => {
        clearTimeout(timeout);
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
