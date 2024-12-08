// Dualsub.js

const url = $request.url;

// 读取和解析参数
const args = new URLSearchParams($request.arguments);
const Types = args.get('Types');
const Languages0 = args.get('Languages0');
const Languages1 = args.get('Languages1');
const Position = args.get('Position');
const Vendor = args.get('Vendor');
const ShowOnly = args.get('ShowOnly');

// 读取持久化存储中的设置
let settings = $persistentStore.read() || "{}";
settings = JSON.parse(settings);

// 判断当前服务是否为 BBCiPlayer
const service = "BBCiPlayer";

// 确保服务的设置存在
if (!settings[service]) {
    settings[service] = {
        type: "Google", // 可选: Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "zh", // 目标语言
        line: "s", // 双行模式 's' 或 'f'
        dkey: "null", // DeepL API key（如果使用 DeepL）
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    };
}

let setting = settings[service];

// 处理 `action=get` 请求
if (url.includes('action=get')) {
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

// 处理 `action=set` 请求
if (url.includes('action=set')) {
    const new_setting = JSON.parse($request.body);
    if (new_setting.type !== "External") setting.external_subtitles = "null";
    if (new_setting.type === "Reset") {
        setting = {
            type: "Google",
            lang: "English",
            sl: "auto",
            tl: "zh",
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
        };
    } else {
        for (const key in new_setting) {
            if (setting.hasOwnProperty(key)) {
                setting[key] = new_setting[key];
            }
        }
    }
    settings[service] = setting;
    $persistentStore.write(JSON.stringify(settings));
    delete setting.t_subtitles_url;
    delete setting.subtitles;
    delete setting.external_subtitles;
    $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

// 处理字幕文件请求
if ((url.match(/\.vtt$/) || url.match(/\.xml$/)) && service === "BBCiPlayer") {
    // 如果已经有缓存的翻译字幕，直接返回
    if (url === setting.s_subtitles_url && setting.subtitles !== "null" && setting.subtitles_type === setting.type && setting.subtitles_sl === setting.sl && setting.subtitles_tl === setting.tl && setting.subtitles_line === setting.line) {
        $done({ body: setting.subtitles });
    }

    // 如果设置为禁用翻译，直接返回原始字幕
    if (setting.type === "Disable") {
        $done({ body: $response.body });
    }

    let body = $response.body;
    if (!body) {
        $done({});
    }

    // 根据设置类型处理字幕
    if (setting.type === "Google" || setting.type === "DeepL") {
        machine_subtitles(setting.type, body);
    } else if (setting.type === "External") {
        external_subtitles(body);
    } else { // Official
        official_subtitles(body);
    }
}

// 外部字幕处理函数
function external_subtitles(body) {
    let external = setting.external_subtitles;
    // 在每个 <span> 标签内添加外部字幕
    body = body.replace(/(<span[^>]*>)([^<]+)(<\/span>)/g, (match, p1, p2, p3) => `${p1}${p2} / ${external}${p3}`);
    $done({ body });
}

// 机器翻译字幕处理函数
async function machine_subtitles(type, body) {
    // 提取 <span> 标签内的文本
    let textPatterns = body.match(/<span[^>]*>[^<]+<\/span>/g);
    if (!textPatterns) {
        $done({});
    }

    let texts = textPatterns.map(span => {
        let match = span.match(/<span[^>]*>([^<]+)<\/span>/);
        return match ? match[1].trim() : "";
    });

    // 分组文本以适应 API 限制
    let groupedTexts = groupAgain(texts, type === "Google" ? 80 : 50);

    let translatedTexts = [];

    // 翻译处理
    if (type === "Google") {
        for (let group of groupedTexts) {
            let query = group.join("\n");
            let options = {
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${setting.sl}&tl=${setting.tl}&dt=t&q=${encodeURIComponent(query)}`,
                headers: { "User-Agent": "Mozilla/5.0" },
            };
            try {
                let trans = await send_request(options, "get");
                if (trans && Array.isArray(trans[0])) {
                    let translatedGroup = trans[0].map(item => item[0]).join("\n");
                    translatedTexts.push(...translatedGroup.split("\n"));
                }
            } catch (error) {
                console.error("Google 翻译错误:", error);
            }
        }
    } else if (type === "DeepL") {
        for (let group of groupedTexts) {
            let query = group.join("\n");
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `auth_key=${setting.dkey}&target_lang=${setting.tl}&text=${encodeURIComponent(query)}`
            };
            try {
                let trans = await send_request(options, "post");
                if (trans.translations) {
                    for (let translation of trans.translations) {
                        translatedTexts.push(translation.text.replace(/\n/g, " "));
                    }
                }
            } catch (error) {
                console.error("DeepL 翻译错误:", error);
            }
        }
    }

    // 将翻译后的文本重新插入到 TTML 中，形成双语字幕
    let translatedIndex = 0;
    body = body.replace(/(<span[^>]*>)([^<]+)(<\/span>)/g, (match, p1, p2, p3) => {
        if (translatedIndex < translatedTexts.length) {
            let translatedText = translatedTexts[translatedIndex].trim();
            translatedIndex++;
            return `${p1}${p2} / ${translatedText}${p3}`;
        } else {
            return match;
        }
    });

    // 保存翻译后的字幕
    setting.s_subtitles_url = url;
    setting.subtitles = body;
    setting.subtitles_type = setting.type;
    setting.subtitles_sl = setting.sl;
    setting.subtitles_tl = setting.tl;
    setting.subtitles_line = setting.line;
    $persistentStore.write(JSON.stringify(settings));

    $done({ body });
}

// 官方字幕处理函数（目前不需要处理）
async function official_subtitles(body) {
    $done({ body });
}

// 发送请求函数
function send_request(options, method) {
    return new Promise((resolve, reject) => {
        if (method === "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject('Error');
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }

        if (method === "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject('Error');
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({});
                }
            });
        }
    });
}

// 分组函数
function groupAgain(data, num) {
    let result = [];
    for (let i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num));
    }
    return result;
}
