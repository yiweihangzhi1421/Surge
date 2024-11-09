/*
    Dualsub for Surge by Neurogram

    - Disney+, Star+, HBO Max, Prime Video, YouTube official bilingual subtitles
    - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. external subtitles
    - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. machine translation bilingual subtitles (Google, DeepL)
    - Customized language support

    Manual:
    Setting tool for Shortcuts: https://www.icloud.com/shortcuts/8ec4a2a3af514282bf27a11050f39fc2

    Author:
    Telegram: Neurogram
    GitHub: Neurogram-R
*/

// 用户设置部分
let userSettings = {
    Disney: {
        type: "Google", // 字幕类型: Google
        lang: "双语", // 显示语言：双语
        sl: "auto", // 源语言
        tl: "zh,en", // 目标语言（中文和英文）
        line: "s", // 行格式: f (新行), s (同一行)
        dkey: "null", // DeepL API 密钥
        external_subtitles: "null" // 外部字幕 URL
    },
    HBOMax: {
        type: "Google",
        lang: "双语",
        sl: "auto",
        tl: "zh,en",
        line: "s",
        dkey: "null",
        external_subtitles: "null"
    },
    Hulu: {
        type: "Google",
        lang: "双语",
        sl: "auto",
        tl: "zh,en",
        line: "s",
        dkey: "null",
        external_subtitles: "null"
    },
    Netflix: {
        type: "Google",
        lang: "双语",
        sl: "auto",
        tl: "zh,en",
        line: "s",
        dkey: "null",
        external_subtitles: "null"
    },
    Paramount: {
        type: "Google",
        lang: "双语",
        sl: "auto",
        tl: "zh,en",
        line: "s",
        dkey: "null",
        external_subtitles: "null"
    },
    PrimeVideo: {
        type: "Google",
        lang: "双语",
        sl: "auto",
        tl: "zh,en",
        line: "s",
        dkey: "null",
        external_subtitles: "null"
    },
    YouTube: {
        type: "Google",
        lang: "双语",
        sl: "auto",
        tl: "zh,en",
        line: "s"
    }
};

// 现有代码开始
let url = $request.url;
let headers = $request.headers;

// 继续处理请求的逻辑
let service = "";
if (url.match(/(dss|star)ott.com/)) service = "Disney";
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax";
if (url.match(/huluim.com/)) service = "Hulu";
if (url.match(/nflxvideo.net/)) service = "Netflix";
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount";
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo";
if (url.match(/youtube.com/)) service = "YouTube";

if (!service) $done({});

// 获取当前服务的设置
let setting = userSettings[service] || {};

// 处理获取设置和保存设置的请求
if (url.match(/action=get/)) {
    // 返回当前设置
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
    let newSetting = JSON.parse($request.body);
    // 更新设置的逻辑
    if (newSetting.type) setting.type = newSetting.type;
    if (newSetting.lang) setting.lang = newSetting.lang;
    if (newSetting.sl) setting.sl = newSetting.sl;
    if (newSetting.tl) setting.tl = newSetting.tl;
    if (newSetting.line) setting.line = newSetting.line;
    // ... 其他设置的更新

    // 将更新后的设置保存回存储
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

// 继续处理字幕逻辑...
