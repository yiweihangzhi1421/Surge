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

function batchTranslate(textArray, callback) {
    const joinedText = textArray.join('\n');
    const options = {
        url: `https://translate.google.com/translate_a/single?client=gtx&dt=t&sl=${settings.sl}&tl=${settings.tl}`,
        headers: { 'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)' },
        body: `q=${encodeURIComponent(joinedText)}`
    };

    $httpClient.post(options, (error, response, data) => {
        if (error || !data) {
            console.log(`批量翻译失败: ${error}`);
            callback(null);
            return;
        }
        try {
            const result = JSON.parse(data);
            const translations = result.sentences.map((s) => s.trans.trim());
            callback(translations);
        } catch (e) {
            console.log(`解析失败: ${e}`);
            callback(null);
        }
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
    const timings = subtitleBlocks.map((block) => block.split('\n')[0]);
    const texts = subtitleBlocks.map((block) => {
        const lines = block.split('\n').slice(1);
        return lines.join(' ').trim();
    });

    batchTranslate(texts, (translatedTexts) => {
        if (!translatedTexts) {
            $done({ body: header + body });
            return;
        }

        const translatedBlocks = subtitleBlocks.map((block, index) => {
            const timing = timings[index];
            const original = texts[index];
            const translated = translatedTexts[index] || original;
            return `${timing}\n${original}\n${translated}`;
        });

        $done({ body: header + translatedBlocks.join('\n\n') });
    });
}

if (url.includes('.vtt')) {
    processSubtitles($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
}
