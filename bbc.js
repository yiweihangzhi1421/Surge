let url = $request.url;
let headers = $request.headers;
let body = $response.body;

let default_settings = {
    Disney: {
        type: "Official", // Official, Google, DeepL, External, Disable
        lang: "English [CC]",
        sl: "auto",
        tl: "zh", // 改成中文
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    BBCiPlayer: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "zh", // 改成中文
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    }
};

let settings = $persistentStore.read();
if (!settings) settings = default_settings;
if (typeof (settings) == "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/(dss|star)ott.com/)) service = "Disney";
if (url.match(/vod-hls-.+(\.live\.cf\.md\.bbci\.co\.uk|-live\.akamaized\.net)/) && url.match(/\.m3u8/)) service = "BBCiPlayer";

console.log(`[DEBUG] Service detected: ${service}`);

if (!service) {
    console.log("[DEBUG] No matching service found.");
    $done({});
}

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

console.log(`[DEBUG] Settings for ${service}:`, setting);

if (service == "BBCiPlayer") {
    if (!url.match(/\.m3u8$/)) {
        console.log("[DEBUG] URL does not match .m3u8 pattern, skipping.");
        $done({});
    }

    console.log("[DEBUG] Redirecting to remote script for BBC iPlayer subtitles.");
    let remote_script_path = "https://github.com/DualSubs/Universal/releases/download/v1.6.10/Manifest.response.bundle.js";
    let options = {
        url: remote_script_path,
        headers: headers
    };
    $httpClient.get(options, function (error, response, body) {
        if (error) {
            console.log(`[ERROR] Failed to load remote script: ${error}`);
            $done({});
            return;
        }
        console.log("[DEBUG] Successfully fetched remote script.");
        eval(body); // 执行远程脚本
        $done({});
    });
}

if (url.match(/action=get/)) {
    console.log("[DEBUG] Processing action=get request.");
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
    console.log("[DEBUG] Processing action=set request.");
    let new_setting = JSON.parse($request.body);
    console.log("[DEBUG] New settings received:", new_setting);
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
    console.log(`[DEBUG] Updated settings for ${service}:`, settings[service]);
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

// 插入中文字幕信息
if (url.match(/vod-hls-.+(\.live\.cf\.md\.bbci\.co\.uk|-live\.akamaized\.net)/) && url.match(/\.m3u8/)) {
    console.log("[DEBUG] 处理BBC iPlayer字幕请求");
    body = body.replace(/(#EXT-X-MEDIA:TYPE=SUBTITLES.*)/g, `$1\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"Chinese\",LANGUAGE=\"zh\",AUTOSELECT=YES,URI=\"https://your-chinese-subtitle-url.m3u8\"`);
}

// 替换所有的URI为https协议
body = body.replace(/URI=\"http:\/\/([^\"]+)\"/g, 'URI="https://$1"');

// 将中文字幕和英文字幕分组
body = body.replace(/(#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"Chinese\".*\n)(#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"English\".*)/g, '$1\n$2');

$done({ body });
