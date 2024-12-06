/*
    Dualsub for Surge with BBC iPlayer Support
*/

let url = $request.url;
let headers = $request.headers;

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
    // Adding BBC iPlayer settings
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
    },
    // Other services omitted for brevity...
};

// Reading and handling settings
let settings = $persistentStore.read();
if (!settings) settings = default_settings;
if (typeof (settings) == "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/(dss|star)ott.com/)) service = "Disney";
// Adding BBC iPlayer URL pattern matching
if (url.match(/vod-hls-.+(\.live\.cf\.md\.bbci\.co\.uk|-live\.akamaized\.net)/) && url.match(/\.m3u8/)) service = "BBCiPlayer";

console.log(`[DEBUG] Service detected: ${service}`);

if (!service) {
    console.log("[DEBUG] No matching service found.");
    $done({});
}

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

console.log(`[DEBUG] Settings for ${service}:`, setting);

// BBC iPlayer Subtitle Request Handling
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

// Processing `action=get` and `action=set` requests
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

// External subtitles function
function external_subtitles() {
    console.log("[DEBUG] Processing external subtitles.");
    // Similar logic to handle external subtitles
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`);
    if (!setting.external_subtitles.match(patt)) {
        console.log("[DEBUG] No matching external subtitles pattern found.");
        $done({});
    }
    if (!body.match(patt)) {
        console.log("[DEBUG] No matching pattern in response body for external subtitles.");
        $done({});
    }
    let external = setting.external_subtitles.replace(/(\\d+:\\d\\d:\\d\\d),(\\d\\d\\d)/g, "$1.$2");
    body = body.replace(patt, external.match(patt)[0]);
    console.log("[DEBUG] External subtitles processed successfully.");
    $done({ body });
}

// Machine translation function
async function machine_subtitles(type) {
    console.log(`[DEBUG] Processing machine translation with type: ${type}`);
    // Logic for Google or DeepL translations (as in the original code)
}

// Helper functions omitted for brevity...

$done({});
