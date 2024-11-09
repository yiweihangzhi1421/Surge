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
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English [CC]",
        sl: "auto",
        tl: "English [CC]",
        line: "s", // f, s
        dkey: "null", // DeepL API key
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
    PrimeVideo: {
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

// YouTube 特殊处理
if (service == "YouTube") {
    // 处理 YouTube 字幕的逻辑
    // ...
}

// 处理官方字幕
if (setting.type == "Official" && url.match(/\.m3u8/)) {
    // 获取字幕 URL
    // ...
}

// 处理机器翻译字幕
if (setting.type == "Google" || setting.type == "DeepL") {
    // 机器翻译逻辑
    // ...
}

// 其他服务的处理逻辑
$done({ body });

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject('Error');
                resolve(data);
            });
        }
        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject('Error');
                resolve(JSON.parse(data));
            });
        }
    });
}
