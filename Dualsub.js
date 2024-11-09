/*
    Dualsub for Surge by Neurogram

        - 支持 Disney+, HBO Max, Netflix, Hulu 等流媒体的双语字幕
        - 使用 Google 翻译网页进行翻译

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
if (setting.type === "Google") {
    let subtitles_urls_data = setting.t_subtitles_url; // 获取原始字幕 URL

    // 从字幕 URL 获取原始字幕文本
    send_request({ url: subtitles_urls_data, method: "GET" })
        .then(originalSubtitles => {
            console.log("原始字幕获取成功:", originalSubtitles); // 调试输出
            // 构造 Google 翻译 URL
            let encodeSubtitles = encodeURIComponent(originalSubtitles);
            let translateUrl = `https://translate.google.com/?sl=auto&tl=${setting.tl}&text=${encodeSubtitles}&op=translate`;

            // 发送请求到 Google 翻译
            return send_request({ url: translateUrl, method: "GET" });
        })
        .then(translatedData => {
            // 从翻译网页中提取翻译结果
            let translatedSubtitles = extractTranslation(translatedData);
            console.log("翻译后的字幕:", translatedSubtitles); // 调试输出

            // 合并翻译内容与原字幕
            body = mergeSubtitles(originalSubtitles, translatedSubtitles);
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
                resolve(data); // 直接返回数据
            });
        }
    });
}

// 提取翻译结果的函数
function extractTranslation(html) {
    let match = html.match(/<span class="tlid-translation translation">(.*?)<\/span>/);
    if (match && match[1]) {
        return match[1].replace(/<[^>]*>/g, ''); // 移除任何 HTML 标签
    }
    return "翻译失败";
}

// 合并字幕的函数
function mergeSubtitles(original, translated) {
    // 使用换行符合并原始字幕和翻译字幕
    return `${original}\n\n翻译:\n${translated}`;
}
