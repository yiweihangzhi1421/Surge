/*
    Dualsub for Surge by Neurogram

    - 自动检测原始语言，使用 Google 翻译成中文
    - 合并显示原始字幕和翻译字幕

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Disney: {
        type: "Google", // 使用 Google 翻译
        lang: "自动检测", // 自动检测
        sl: "auto", // 源语言自动
        tl: "zh", // 目标语言中文
        line: "s", // 合并显示
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    },
    HBOMax: {
        type: "Google",
        lang: "自动检测",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    },
    Hulu: {
        type: "Google",
        lang: "自动检测",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    },
    Netflix: {
        type: "Google",
        lang: "自动检测",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    },
    Paramount: {
        type: "Google",
        lang: "自动检测",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    },
    PrimeVideo: {
        type: "Google",
        lang: "自动检测",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    },
    YouTube: {
        type: "Google",
        lang: "自动检测",
        sl: "auto",
        tl: "zh",
        line: "s",
        dkey: "null",
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        external_subtitles: "null"
    }
};

let settings = $persistentStore.read() || default_settings;

if (typeof settings === "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/(dss|star)ott.com/)) service = "Disney";
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax";
if (url.match(/huluim.com/)) service = "Hulu";
if (url.match(/nflxvideo.net/)) service = "Netflix";
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount";
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo";
if (url.match(/youtube.com/)) service = "YouTube";

if (!service) $done({});

// 确保当前服务的设置存在
if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 处理获取设置请求
if (url.match(/action=get/)) {
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

// 处理设置请求
if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body);
    settings[service] = { ...settings[service], ...new_setting };
    $persistentStore.write(JSON.stringify(settings));
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 如果类型为 "Disable"，则不处理
if (setting.type === "Disable") $done({});

// 处理字幕合并逻辑
let body = $response.body;

if (!body) $done({});

// 合并显示逻辑
if (setting.type === "Google") {
    let original_subs = body; // 假设 body 是原始字幕内容
    let translated_subs = translate_subtitles(original_subs, setting.tl); // 调用翻译函数
    let merged_subs = merge_subtitles(original_subs, translated_subs);
    $done({ body: merged_subs });
}

// 模拟翻译字幕的函数（这里需要替换成实际的翻译调用）
function translate_subtitles(subs, targetLang) {
    // 这里可以调用实际的翻译 API（如 Google Translate API），目前返回原始字幕
    return subs; // 直接返回原始字幕作为示例
}

// 合并原始字幕和翻译字幕
function merge_subtitles(original, translated) {
    let merged = "";
    let original_lines = original.split("\n");
    let translated_lines = translated.split("\n");

    for (let i = 0; i < Math.max(original_lines.length, translated_lines.length); i++) {
        if (original_lines[i]) merged += original_lines[i] + "\n"; // 原始字幕
        if (translated_lines[i]) merged += translated_lines[i] + "\n"; // 翻译字幕
    }
    return merged.trim();
}
