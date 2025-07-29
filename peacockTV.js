/*
    Dualsub for Peacock iOS
    Optimized for Amazon S3 responses
*/

let url = $request.url
let headers = $request.headers

let default_settings = {
    Peacock: {
        type: "Google",
        lang: "Chinese",
        sl: "auto",
        tl: "zh-CN",
        line: "f",
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
}

console.log("[Peacock] Processing URL:", url);

// 读取设置或使用默认设置
let settings = $persistentStore.read()
if (!settings) {
    console.log("[Peacock] No settings found, using defaults");
    settings = default_settings
}

// 解析JSON设置
if (typeof (settings) == "string") {
    try {
        settings = JSON.parse(settings)
    } catch (e) {
        console.log("[Peacock] Error parsing settings:", e);
        settings = default_settings
    }
}

// 服务检测
let service = ""
if (url.match(/peacocktv\.com/)) {
    service = "Peacock"
    console.log("[Peacock] Service detected")
}

if (!service) {
    console.log("[Peacock] No supported service detected")
    $done({})
}

if (!settings[service]) settings[service] = default_settings[service]
let setting = settings[service]
// 设置处理
if (url.match(/action=get/)) {
    console.log("[Peacock] Handling get action");
    delete setting.t_subtitles_url
    delete setting.subtitles
    delete setting.external_subtitles
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } })
}

if (url.match(/action=set/)) {
    console.log("[Peacock] Handling set action");
    let new_setting = JSON.parse($request.body)
    if (new_setting.type != "External") settings[service].external_subtitles = "null"
    if (new_setting.type == "Reset") new_setting = default_settings[service]
    if (new_setting.type) settings[service].type = new_setting.type
    if (new_setting.lang) settings[service].lang = new_setting.lang
    if (new_setting.sl) settings[service].sl = new_setting.sl
    if (new_setting.tl) settings[service].tl = new_setting.tl
    if (new_setting.line) settings[service].line = new_setting.line
    if (new_setting.dkey) settings[service].dkey = new_setting.dkey
    if (new_setting.s_subtitles_url) settings[service].s_subtitles_url = new_setting.s_subtitles_url
    if (new_setting.t_subtitles_url) settings[service].t_subtitles_url = new_setting.t_subtitles_url
    if (new_setting.subtitles) settings[service].subtitles = new_setting.subtitles
    if (new_setting.subtitles_type) settings[service].subtitles_type = new_setting.subtitles_type
    if (new_setting.subtitles_sl) settings[service].subtitles_sl = new_setting.subtitles_sl
    if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.subtitles_tl
    if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line
    if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "")
    $persistentStore.write(JSON.stringify(settings))
    delete settings[service].t_subtitles_url
    delete settings[service].subtitles
    delete settings[service].external_subtitles
    $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } })
}

if (setting.type == "Disable") $done({})

let body = $response.body
if (!body) $done({})

// 处理 S3 的 octet-stream 响应
if ($response.headers['Content-Type'] === 'application/octet-stream') {
    try {
        body = new TextDecoder().decode(body)
        console.log("[Peacock] Successfully decoded binary response")
    } catch (e) {
        console.log("[Peacock] Error decoding binary response:", e)
        $done({})
    }
}

if (url.match(/\.(vtt|webvtt)/) || service == "Peacock") {
    console.log("[Peacock] Processing subtitle file")
    
    // 检查缓存
    if (url == setting.s_subtitles_url && 
        setting.subtitles != "null" && 
        setting.subtitles_type == setting.type && 
        setting.subtitles_sl == setting.sl && 
        setting.subtitles_tl == setting.tl && 
        setting.subtitles_line == setting.line) {
        console.log("[Peacock] Using cached subtitles")
        $done({ body: setting.subtitles })
        return
    }

    if (setting.type == "Google") {
        console.log("[Peacock] Using Google Translate")
        machine_subtitles("Google")
    }
}
async function machine_subtitles(type) {
    console.log("[Peacock] Starting translation process");
    
    try {
        // 保留 WEBVTT 和 X-TIMESTAMP-MAP
        let header = body.match(/^WEBVTT[\s\S]*?(?=\d{2}:)/)?.[0] || 'WEBVTT\n\n';
        let content = body.replace(/^WEBVTT[\s\S]*?(?=\d{2}:)/, '');

        // 分离字幕块
        let subtitles = content.split('\n\n').filter(block => block.trim());
        
        let translatable_text = [];
        let subtitle_data = [];
        
        // 处理每个字幕块
        for (let block of subtitles) {
            let lines = block.split('\n');
            let timecode_index = lines.findIndex(line => line.match(/^\d{2}:\d{2}:/));
            
            if (timecode_index === -1) continue;
            
            let timing = lines[timecode_index];
            let format_lines = lines.slice(0, timecode_index);
            let text_lines = lines.slice(timecode_index + 1);
            let text = text_lines.join(' ')
                .replace(/<\/?[^>]+(>|$)/g, '')  // 移除HTML标签
                .trim();
            
            subtitle_data.push({
                timing: timing,
                format: format_lines,
                original: text_lines.join('\n'),
                text: text,
                is_effect: text.match(/^\[.*\]$/) || false
            });
            
            if (text && !text.match(/^\[.*\]$/)) {
                translatable_text.push(`${type == "Google" ? "~" + translatable_text.length + "~" : "&text="}${text}`);
            }
        }
        
        console.log(`[Peacock] Found ${subtitle_data.length} subtitle blocks`);
        console.log(`[Peacock] Preparing to translate ${translatable_text.length} lines`);

        // 翻译处理
        let translations = [];
        for (let batch of groupAgain(translatable_text, type == "Google" ? 80 : 50)) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                headers: {
                    'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
                },
                body: `q=${encodeURIComponent(batch.join("\n"))}`
            };
            
            let trans = await send_request(options, "post");
            console.log("[Peacock] Translation batch received");
            
            if (trans.sentences) {
                trans.sentences.forEach(sentence => {
                    if (sentence.trans) {
                        translations.push(sentence.trans.replace(/\n$/g, "").replace(/\n/g, " "));
                    }
                });
            }
        }

        // 重建字幕
        let new_body = header;
        let trans_index = 0;
        
        subtitle_data.forEach(item => {
            // 添加格式信息
            if (item.format.length > 0) {
                new_body += item.format.join('\n') + '\n';
            }
            
            // 添加时间码
            new_body += item.timing + '\n';
            
            // 添加原文
            new_body += item.original + '\n';
            
            // 如果不是音效字幕且有翻译，添加翻译
            if (!item.is_effect && translations[trans_index]) {
                new_body += translations[trans_index] + '\n';
                trans_index++;
            }
            
            new_body += '\n';
        });

        console.log("[Peacock] Subtitle rebuild completed");

        // 缓存处理
        if (service != "Netflix") {
            settings[service].s_subtitles_url = url;
            settings[service].subtitles = new_body;
            settings[service].subtitles_type = setting.type;
            settings[service].subtitles_sl = setting.sl;
            settings[service].subtitles_tl = setting.tl;
            settings[service].subtitles_line = setting.line;
            $persistentStore.write(JSON.stringify(settings));
        }
        
        $done({ body: new_body });
        
    } catch (error) {
        console.log("[Peacock] Process error:", error);
        $done({});
    }
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) {
                    console.log("[Peacock] Request error:", error);
                    return reject('Error');
                }
                try {
                    let parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    console.log("[Peacock] Parse error:", e);
                    reject(e);
                }
            });
        }
    });
}

function groupAgain(data, num) {
    var result = [];
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
