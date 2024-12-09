// Dualsub for Kanopy with Chinese-English subtitles

let url = $request.url;
let headers = $request.headers;

let default_settings = {
    Kanopy: {
        type: "Google",
        lang: "Chinese",
        sl: "auto",
        tl: "zh-CN",
        line: "s",
        dkey: "null",
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

console.log("[Kanopy] Processing URL:", url);

// Load settings or use default
let settings = $persistentStore.read();
if (!settings) {
    console.log("[Kanopy] No settings found, using defaults");
    settings = default_settings;
}

// Parse JSON settings
if (typeof (settings) == "string") {
    try {
        settings = JSON.parse(settings);
    } catch (e) {
        console.log("[Kanopy] Error parsing settings:", e);
        settings = default_settings;
    }
}

// Service detection
let service = "";
if (url.match(/kanopy\.com/)) {
    service = "Kanopy";
    console.log("[Kanopy] Service detected");
}

if (!service) {
    console.log("[Kanopy] No supported service detected");
    $done({});
}

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

// Handle get action
if (url.match(/action=get/)) {
    console.log("[Kanopy] Handling get action");
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

// Handle set action
if (url.match(/action=set/)) {
    console.log("[Kanopy] Handling set action");
    let new_setting = JSON.parse($request.body);
    if (new_setting.type != "External") settings[service].external_subtitles = "null";
    if (new_setting.type == "Reset") new_setting = default_settings[service];
    Object.assign(settings[service], new_setting);
    $persistentStore.write(JSON.stringify(settings));
    delete settings[service].t_subtitles_url;
    delete settings[service].subtitles;
    delete settings[service].external_subtitles;
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

if (setting.type == "Disable") {
    $done({});
    return;
}

let body = $response.body;
if (!body) {
    $done({});
    return;
}

// Process subtitles
if (url.match(/\.vtt$/) || service == "Kanopy") {
    console.log("[Kanopy] Processing subtitle file");
    
    // Check cache
    if (url == setting.s_subtitles_url && 
        setting.subtitles != "null" && 
        setting.subtitles_type == setting.type && 
        setting.subtitles_sl == setting.sl && 
        setting.subtitles_tl == setting.tl && 
        setting.subtitles_line == setting.line) {
        console.log("[Kanopy] Using cached subtitles");
        $done({ body: setting.subtitles });
        return;
    }

    if (setting.type == "Google") {
        console.log("[Kanopy] Using Google Translate");
        machine_subtitles("Google");
    }
}

async function machine_subtitles(type) {
    console.log("[Kanopy] Starting translation process");

    try {
        let header = body.match(/^WEBVTT[\s\S]*?(?=\d{2}:)/)?.[0] || 'WEBVTT\n\n';
        let content = body.replace(/^WEBVTT[\s\S]*?(?=\d{2}:)/, '');
        let subtitles = content.split('\n\n').filter(block => block.trim());
        let translatable_text = [];
        let subtitle_data = [];

        for (let block of subtitles) {
            let lines = block.split('\n');
            let timecode_index = lines.findIndex(line => line.match(/^\d{2}:\d{2}:/));
            if (timecode_index === -1) continue;
            let timing = lines[timecode_index];
            let format_lines = lines.slice(0, timecode_index);
            let text_lines = lines.slice(timecode_index + 1);
            let text = text_lines.join(' ').replace(/<\/?[^>]+(>|$)/g, '').trim();
            subtitle_data.push({ timing, format: format_lines, original: text_lines.join('\n'), text });
            if (text) translatable_text.push(`${type == "Google" ? "~" + translatable_text.length + "~" : "&text="}${text}`);
        }

        console.log(`[Kanopy] Found ${subtitle_data.length} subtitle blocks`);
        console.log(`[Kanopy] Preparing to translate ${translatable_text.length} lines`);

        let translations = [];
        for (let batch of groupAgain(translatable_text, type == "Google" ? 80 : 50)) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&sl=${setting.sl}&tl=${setting.tl}`,
                headers: { 'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)' },
                body: `q=${encodeURIComponent(batch.join("\n"))}`
            };
            console.log("[Kanopy] Sending translation request:", options.url);
            let trans = await send_request(options, "post");
            console.log("[Kanopy] Translation response received:", trans);

            if (trans && trans.sentences) {
                trans.sentences.forEach(sentence => {
                    if (sentence.trans) {
                        translations.push(sentence.trans.replace(/\n$/g, "").replace(/\n/g, " "));
                    }
                });
            } else {
                console.log("[Kanopy] No valid translation sentences found");
            }
        }

        let new_body = header;
        let trans_index = 0;
        subtitle_data.forEach(item => {
            if (item.format.length > 0) new_body += item.format.join('\n') + '\n';
            new_body += item.timing + '\n';
            new_body += item.original + '\n';
            if (translations[trans_index]) new_body += translations[trans_index++] + '\n';
            new_body += '\n';
        });

        console.log("[Kanopy] Subtitle rebuild completed");
        settings[service].s_subtitles_url = url;
        settings[service].subtitles = new_body;
        $persistentStore.write(JSON.stringify(settings));
        $done({ body: new_body });
    } catch (error) {
        console.error("[Kanopy] Process error:", error);
        $done({});
    }
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        $httpClient.post(options, function (error, response, data) {
            if (error) {
                console.log("[Kanopy] Request error:", error);
                return reject('Error');
            }
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                console.log("[Kanopy] Parse error:", e);
                reject(e);
            }
        });
    });
}

function groupAgain(data, num) {
    var result = [];
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
