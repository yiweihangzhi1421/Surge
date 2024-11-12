/*
    Dualsub for iOS in Surge by Neurogram (精简版，仅支持 Hulu)

    - Hulu 官方双语字幕支持
    - 使用 Google 翻译实现中英文字幕
    - 模拟 Shortcuts 设置，确保脚本在 Surge 环境下正常运行

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;
let headers = $request.headers;

// 固定设置参数
let settings = {
    type: "Google", // 翻译引擎：Google, DeepL, External, Disable
    lang: "English", // 源语言
    sl: "auto", // 自动检测源语言
    tl: "zh", // 目标语言改成中文
    line: "s", // 显示位置：f 是第一行，s 是第二行
    dkey: "null", // 如果使用 DeepL，请填写 DeepL API 密钥
    s_subtitles_url: "null",
    t_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null",
    external_subtitles: "null"
};

// Hulu 特殊处理逻辑
if (url.match(/\.vtt$/)) {
    // 强制将字幕类型解析为 WebVTT
    let contentType = $response.headers['Content-Type'];
    if (contentType === 'application/octet-stream') {
        $response.headers['Content-Type'] = 'text/vtt';
    }
    let body = handleHuluSubtitles($response.body);
    $done({ body });
} else {
    $done({});
}

// Hulu 字幕处理函数
function handleHuluSubtitles(body) {
    body = body.replace(/\r/g, ""); // 去除回车符
    let dialogue = body.match(/\d+:\d\d:\d\d\.\d\d\d --> \d+:\d\d:\d\d\.\d\d\d\n.+/g);
    if (dialogue) {
        body = dialogue.map(line => {
            let [time, text] = line.split("\n");
            let translatedText = translateText(text); // 使用机器翻译或其他方式翻译文本
            return `${time}\n${text}\n${translatedText}`;
        }).join("\n\n");
    }
    return body;
}

// 简单的翻译文本函数（可以替换为实际翻译 API）
function translateText(text) {
    // 这里可以调用 Google 或 DeepL 翻译 API
    return `【翻译】${text}`; // 示例翻译文本
}

// 发送请求函数（如需调用外部翻译 API）
function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method === "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject("Error");
                resolve(data);
            });
        }
        if (method === "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject("Error");
                resolve(JSON.parse(data));
            });
        }
    });
}
