/*
    Dualsub for Surge by Neurogram

        - 支持 Disney+, HBO Max, Netflix, Hulu 等流媒体的双语字幕
        - 自定义语言支持

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;
let headers = $request.headers;

// 默认设置
let default_settings = {
    Disney: {
        type: "Official",
        lang: "English [CC]",
        sl: "auto",
        tl: "English [CC]",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null"
    },
    HBOMax: {
        type: "Official",
        lang: "English CC",
        sl: "auto",
        tl: "en-US SDH",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null"
    },
    Hulu: {
        type: "Google",
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null"
    },
    Netflix: {
        type: "Google",
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null"
    },
    YouTube: {
        type: "Enable",
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "sl"
    }
};

let settings = $persistentStore.read() || default_settings;

// 根据 URL 确定服务
let service = "";
if (url.match(/(dss|star)ott.com/)) service = "Disney";
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax";
if (url.match(/huluim.com/)) service = "Hulu";
if (url.match(/nflxvideo.net/)) service = "Netflix";
if (url.match(/youtube.com/)) service = "YouTube";

if (!service) $done({});

// 处理字幕请求
if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

if (setting.type == "Disable") $done({});

let body = $response.body;

if (!body) $done({});

// 处理翻译字幕
if (setting.type === "Google" || setting.type === "DeepL") {
    let subtitles_urls_data = setting.t_subtitles_url; // 获取原始字幕 URL

    // 假设这里是从字幕 URL 获取的字幕文本
    send_request({ url: subtitles_urls_data, method: "GET" })
        .then(originalSubtitles => {
            // 发送翻译请求到 Google 翻译 API
            return send_request({
                url: 'https://translation.googleapis.com/language/translate/v2', // 替换为您的翻译 API URL
                method: "POST",
                body: JSON.stringify({
                    q: originalSubtitles,
                    target: setting.tl,
                    key: setting.dkey // 如果需要 API 密钥
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            });
        })
        .then(translatedData => {
            // 获取翻译后的字幕文本
            let translatedSubtitles = translatedData.data.translations[0].translatedText;

            // 合并翻译内容与原字幕
            body = mergeSubtitles(body, translatedSubtitles);
            $done({ body });
        })
        .catch(error => {
            console.error("翻译请求失败:", error);
            $done({});
        });
} else {
    $done({ body });
}

// 网络请求函数
function send_request(options) {
    return new Promise((resolve, reject) => {
        if (options.method === "GET") {
            $httpClient.get(options, (error, response, data) => {
                if (error) return reject(error);
                resolve(JSON.parse(data));
            });
        } else if (options.method === "POST") {
            $httpClient.post(options, (error, response, data) => {
                if (error) return reject(error);
                resolve(JSON.parse(data));
            });
        }
    });
}

// 合并字幕的函数
function mergeSubtitles(original, translated) {
    // 这里您可以实现合并逻辑
    // 简单示例：将翻译的字幕添加到原始字幕后面
    return original + "\n\n翻译:\n" + translated;
}
