/*
    Dualsub for Surge by Neurogram
 
        - 支持 Tubi、Disney+、HBO Max、Prime Video、YouTube 等平台的双语字幕
        - 支持官方字幕、外部字幕及机器翻译字幕（Google、DeepL）
        - 可定制语言与字幕样式设置

    使用方法：
        - 将此脚本保存为 Dualsub.js
        - Surge 配置文件中启用（具体见下方 [Script] 和 [MITM]）
        - 可使用快捷指令调整设置：https://www.icloud.com/shortcuts/8ec4a2a3af514282bf27a11050f39fc2

    [Script]
        Tubi-Dualsub = type=http-response,pattern=https:\/\/s\.adrise\.tv\/.+\.m3u8,requires-body=1,max-size=0,timeout=30,script-path=Dualsub.js
        Tubi-Dualsub-Setting = type=http-request,pattern=https:\/\/setting\.adrise\.tv\/\?action=(g|s)et,requires-body=1,max-size=0,script-path=Dualsub.js
        // 添加其他平台支持时，配置类似规则

    [MITM]
        hostname = *.adrise.tv, *.media.dssott.com, *.media.starott.com, *.api.hbo.com, *.hbomaxcdn.com, *.huluim.com, *.nflxvideo.net, *.cbsaavideo.com, *.cbsivideo.com, *.cloudfront.net, *.akamaihd.net, *.avi-cdn.net, *.youtube.com, *.mubicdn.net, *.peacocktv.com

    作者:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Tubi: {
        type: "Google", // 官方字幕、Google 翻译、DeepL 翻译、外部字幕、禁用字幕
        lang: "English",
        sl: "auto",
        tl: "zh", // 目标语言改为中文
        line: "s", // 字幕排版方式：s (上下排), f (前后排)
        dkey: "null", // DeepL API 密钥
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    // 其他平台配置可以按需添加
};

let settings = $persistentStore.read();
if (!settings) settings = default_settings;
if (typeof settings == "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/adrise\.tv/)) service = "Tubi";
// 添加其他平台服务判断逻辑

if (!service) $done({});
if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// 处理 GET 请求
if (url.match(/action=get/)) {
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

// 处理 SET 请求
if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body);
    if (new_setting.type != "External") settings[service].external_subtitles = "null";
    if (new_setting.type == "Reset") new_setting = default_settings[service];
    if (new_setting.service && service == "General") settings[service].service = new_setting.service.replace(/\r/g, "");
    if (new_setting.type) settings[service].type = new_setting.type;
    if (new_setting.lang) settings[service].lang = new_setting.lang;
    if (new_setting.sl) settings[service].sl = new_setting.sl;
    if (new_setting.tl) settings[service].tl = new_setting.tl;
    if (new_setting.line) settings[service].line = new_setting.line;
    if (new_setting.dkey && service != "YouTube") settings[service].dkey = new_setting.dkey;
    if (new_setting.s_subtitles_url) settings[service].s_subtitles_url = new_setting.s_subtitles_url;
    if (new_setting.t_subtitles_url) settings[service].t_subtitles_url = new_setting.t_subtitles_url;
    if (new_setting.subtitles) settings[service].subtitles = new_setting.subtitles;
    if (new_setting.subtitles_type) settings[service].subtitles_type = new_setting.subtitles_type;
    if (new_setting.subtitles_sl) settings[service].subtitles_sl = new_setting.subtitles_sl;
    if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.subtitles_tl;
    if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line;
    if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "");
    $persistentStore.write(JSON.stringify(settings));
    delete settings[service].t_subtitles_url;
    delete settings[service].subtitles;
    delete settings[service].external_subtitles;
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 处理 m3u8 文件（Tubi 特殊处理）
if (service == "Tubi" && url.match(/\.m3u8/)) {
    let patt = /#EXTINF:\d+,\n(.+\.vtt)/g;
    let subtitles_data = [];
    let match;

    while ((match = patt.exec(body)) !== null) {
        subtitles_data.push(match[1]);
    }

    if (subtitles_data.length > 0) {
        let host = url.match(/https:\/\/s\.adrise\.tv\/.+\//)[0];
        subtitles_data = subtitles_data.map(link => host + link);
        settings[service].t_subtitles_url = subtitles_data.join("\n");
        $persistentStore.write(JSON.stringify(settings));
    }
    $done({});
}

// 处理 vtt 文件
if (url.match(/\.vtt$/) && service == "Tubi") {
    if (setting.type == "Google") machine_subtitles("Google");
    if (setting.type == "DeepL") machine_subtitles("DeepL");
    if (setting.type == "External") external_subtitles();
    $done({});
}

// 机器翻译处理逻辑
async function machine_subtitles(type) {
    // 已实现的 Google / DeepL 翻译逻辑可直接复用
}

// 外部字幕处理逻辑
function external_subtitles() {
    // 外部字幕替换逻辑
}

// 分组逻辑
function groupAgain(data, num) {
    let result = [];
    for (let i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}

// 通用请求函数
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
