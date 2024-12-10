/*
    DualSubs.BBC.VTT.js

    功能:
    - 拦截 BBC iPlayer 的 VTT 字幕请求
    - 将英文字幕翻译为中文
    - 生成双语 VTT 字幕，中文字幕在上，英文在下
    - 返回修改后的 VTT 字幕

    作者:
    - 您的名字或联系方式
*/

// 获取请求 URL 和响应体
const url = $request.url;
const body = $response.body;
const headers = $request.headers;

// 固定设置
const sourceLang = "EN"; // 源语言：英文
const targetLang = "ZH"; // 目标语言：中文
const translationType = "Google"; // 翻译类型："Google" 或 "DeepL"
const deepLAuthKey = "YOUR_DEEPL_API_KEY"; // 如果使用 DeepL，请替换为你的 DeepL API 密钥

console.log("DualSubs.BBC.VTT.js 脚本已被触发，URL:", url);

// 解析 VTT 内容
let vttLines = body.split('\n');
let translatedTexts = [];
let originalTexts = [];

// 提取需要翻译的字幕文本
for (let line of vttLines) {
    if (line.trim() === "" || line.startsWith("WEBVTT") || line.startsWith("NOTE") || /^[0-9]+$/.test(line)) {
        continue;
    }
    if (/-->/i.test(line)) {
        continue;
    }
    originalTexts.push(line);
}

if (originalTexts.length === 0) {
    console.log("没有找到需要翻译的字幕文本");
    $done({ body: body });
}

// 分批翻译
translateTexts(originalTexts, function(translations) {
    // 生成双语字幕
    let newVttLines = [];
    let textIndex = 0;

    newVttLines.push("WEBVTT\n");

    for (let line of vttLines) {
        newVttLines.push(line);
        // 插入翻译后的字幕
        if (line && !line.startsWith("WEBVTT") && !line.startsWith("NOTE") && !/-->/i.test(line) && !/^[0-9]+$/.test(line)) {
            if (translations[textIndex]) {
                newVttLines.push(translations[textIndex]);
                textIndex++;
            }
        }
    }

    let newVttBody = newVttLines.join('\n');
    console.log("生成新的双语 VTT 字幕，内容长度:", newVttBody.length);

    // 返回修改后的 VTT 字幕
    $done({ body: newVttBody });
}, function(error) {
    console.log("翻译失败，错误:", error);
    $done({ body: body });
});

// 翻译函数
function translateTexts(texts, success, failure) {
    if (translationType === "Google") {
        translateWithGoogle(texts, success, failure);
    } else if (translationType === "DeepL") {
        translateWithDeepL(texts, success, failure);
    } else {
        console.log("未知的翻译类型:", translationType);
        failure("未知的翻译类型");
    }
}

// 使用 Google Translate API 进行翻译
function translateWithGoogle(texts, success, failure) {
    let query = texts.join("\n");
    let translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(query)}`;

    console.log("使用 Google Translate 进行翻译，URL:", translateUrl);

    $httpClient.get({
        url: translateUrl,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    }, function(error, response, data) {
        if (error || response.status !== 200) {
            console.log("Google 翻译请求失败，错误:", error);
            failure(error || `HTTP 状态码: ${response.status}`);
            return;
        }

        try {
            let result = JSON.parse(data);
            let translations = result[0].map(item => item[0]);
            success(translations);
        } catch (e) {
            console.log("解析 Google 翻译响应失败，错误:", e);
            failure(e);
        }
    });
}

// 使用 DeepL API 进行翻译
function translateWithDeepL(texts, success, failure) {
    let translated = [];
    let remaining = texts.length;

    for (let text of texts) {
        let translateUrl = "https://api-free.deepl.com/v2/translate";

        $httpClient.post({
            url: translateUrl,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `auth_key=${deepLAuthKey}&text=${encodeURIComponent(text)}&source_lang=${sourceLang}&target_lang=${targetLang}`
        }, function(error, response, data) {
            if (error || response.status !== 200) {
                console.log("DeepL 翻译请求失败，错误:", error);
                translated.push("");
            } else {
                try {
                    let json = JSON.parse(data);
                    if (json.translations && json.translations.length > 0) {
                        translated.push(json.translations[0].text);
                    } else {
                        translated.push("");
                    }
                } catch (e) {
                    console.log("解析 DeepL 翻译响应失败，错误:", e);
                    translated.push("");
                }
            }

            remaining--;
            if (remaining === 0) {
                success(translated);
            }
        });
    }
}
