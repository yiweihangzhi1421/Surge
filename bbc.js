/*
    DualSubs.BBC.TTML.js

    功能:
    - 拦截 BBC iPlayer 的 TTML (.xml) 字幕请求
    - 解析 TTML 文件，提取英文字幕文本
    - 翻译英文文本为中文
    - 将中文翻译文本插入到相应的位置，形成双语字幕
    - 返回修改后的 TTML 字幕

    作者:
    - VirgilClyne
*/

// 获取请求 URL 和响应体
const url = $request.url;
const body = $response.body;

// 固定设置
const sourceLang = "EN"; // 源语言：英文
const targetLang = "ZH"; // 目标语言：中文
const translationType = "Google"; // 翻译类型："Google" 或 "DeepL"
const deepLAuthKey = "YOUR_DEEPL_API_KEY"; // 如果使用 DeepL，请替换为你的 DeepL API 密钥

console.log("DualSubs.BBC.TTML.js 脚本已被触发，URL:", url);

// 检查响应体是否存在
if (!body) {
    console.log("响应体为空，脚本终止");
    $done({});
}

// 解析 TTML XML
let parser = new DOMParser();
let xmlDoc = parser.parseFromString(body, "application/xml");

// 检查解析是否成功
if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
    console.log("解析 TTML XML 失败");
    $done({});
}

// 获取所有 <p> 标签（字幕段落）
let paragraphs = xmlDoc.getElementsByTagName("p");
console.log(`找到 ${paragraphs.length} 个 <p> 标签`);

if (paragraphs.length === 0) {
    console.log("没有找到任何字幕段落");
    $done({});
}

// 提取所有字幕文本
let originalTexts = [];
for (let p of paragraphs) {
    let text = p.textContent.trim();
    if (text) {
        originalTexts.push(text);
    }
}

if (originalTexts.length === 0) {
    console.log("没有需要翻译的字幕文本");
    $done({});
}

console.log(`需要翻译的字幕行数: ${originalTexts.length}`);

// 翻译字幕文本
translateTexts(originalTexts, function(translatedTexts) {
    console.log("翻译完成，生成双语 TTML 字幕");

    // 插入翻译后的文本
    let textIndex = 0;
    for (let p of paragraphs) {
        let text = p.textContent.trim();
        if (text) {
            let translatedText = translatedTexts[textIndex];
            textIndex++;

            // 创建一个新的 <span> 标签用于中文翻译
            let span = xmlDoc.createElement("span");
            span.setAttribute("style", "tts:color=\"#00FF00\"; tts:backgroundColor=\"#000000\";"); // 示例样式，可根据需要调整
            span.textContent = translatedText;

            // 插入中文翻译到原始文本之前
            p.insertBefore(span, p.firstChild);

            // 插入一个换行符
            let br = xmlDoc.createElement("br");
            p.insertBefore(br, span.nextSibling);
        }
    }

    // 序列化回 TTML
    let serializer = new XMLSerializer();
    let newBody = serializer.serializeToString(xmlDoc);

    console.log("生成新的双语 TTML 字幕，内容长度:", newBody.length);

    // 返回修改后的 TTML
    $done({ body: newBody });
}, function(error) {
    console.log("翻译失败，错误:", error);
    $done({});
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
