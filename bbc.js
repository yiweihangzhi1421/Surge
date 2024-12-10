/*
    Dualsub for Surge by Neurogram

    支持:
    - BBC iPlayer (TTML 格式)

    功能:
    - 固定英文翻译为中文
    - 中文字幕置于英文字幕上方

    Surge 配置:
        [Script]
        # BBC iPlayer
        BBC = type=http-response,pattern=https:\/\/vod-sub-uk-live\.akamaized\.net\/iplayer\/subtitles\/ng\/modav\/.+\.xml,requires-body=1,max-size=0,timeout=30,script-path=https://raw.githubusercontent.com/Neurogram-R/Surge/master/Dualsub.js

        [MITM]
        hostname = *.vod-sub-uk-live.akamaized.net

    作者:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

const url = $request.url;
const headers = $request.headers;

// 固定设置
const sourceLang = "EN"; // 源语言：英文
const targetLang = "ZH"; // 目标语言：中文
const translationType = "Google"; // 翻译类型："Google" 或 "DeepL"

// 检测是否为 BBC iPlayer 的字幕请求
if (!url.match(/vod-sub-uk-live\.akamaized\.net\/iplayer\/subtitles\/ng\/modav\//)) {
    $done({});
}

// 获取响应体
let body = $response.body;

// 如果响应体为空，结束
if (!body) {
    $done({});
}

// 检查是否为 TTML 格式
if (!url.match(/\.xml$/i)) {
    $done({});
}

// 处理 TTML 字幕
handleTTML(body, translationType);

function handleTTML(body, type) {
    // 解析 TTML XML
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(body, "application/xml");

    // 检查解析是否成功
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        $done({});
        return;
    }

    // 获取所有 <p> 标签
    let paragraphs = xmlDoc.getElementsByTagName("p");

    // 存储需要翻译的文本
    let textsToTranslate = [];

    for (let i = 0; i < paragraphs.length; i++) {
        // 提取纯文本，去除内部标签
        let originalText = paragraphs[i].textContent.trim();
        if (originalText.length > 0) {
            textsToTranslate.push(originalText);
        }
    }

    if (textsToTranslate.length === 0) {
        $done({});
        return;
    }

    // 分批处理翻译请求（防止一次性请求过多）
    let batchSize = 50; // 根据需要调整
    let batches = [];
    for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        batches.push(textsToTranslate.slice(i, i + batchSize));
    }

    // 翻译后的文本
    let translatedTexts = [];

    // 逐批翻译
    (async () => {
        for (let batch of batches) {
            if (type === "Google") {
                let translatedBatch = await translateWithGoogle(batch, sourceLang, targetLang);
                translatedTexts = translatedTexts.concat(translatedBatch);
            } else if (type === "DeepL") {
                let translatedBatch = await translateWithDeepL(batch, sourceLang, targetLang);
                translatedTexts = translatedTexts.concat(translatedBatch);
            }
        }

        // 插入翻译后的文本
        for (let i = 0; i < paragraphs.length; i++) {
            let originalText = paragraphs[i].textContent.trim();
            if (originalText.length > 0 && translatedTexts[i]) {
                // 创建 <span> 标签用于中文字幕
                let chineseSpan = xmlDoc.createElement("span");
                chineseSpan.textContent = translatedTexts[i];
                // 插入 <br/> 标签
                let br = xmlDoc.createElement("br");
                // 插入到原有内容之前
                paragraphs[i].insertBefore(chineseSpan, paragraphs[i].firstChild);
                paragraphs[i].insertBefore(br, chineseSpan);
            }
        }

        // 序列化回 XML
        let serializer = new XMLSerializer();
        let newBody = serializer.serializeToString(xmlDoc);

        // 返回修改后的 TTML
        $done({ body: newBody });
    })();
}

// 使用 Google Translate API 进行翻译
async function translateWithGoogle(texts, sourceLang, targetLang) {
    let translated = [];
    let query = texts.join("\n");
    let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(query)}`;

    try {
        let response = await $httpClient.get({
            url: url,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        if (response.error) {
            return translated;
        }

        let data = response.data;
        // 解析返回的翻译结果
        let result = JSON.parse(data);
        for (let i = 0; i < result[0].length; i++) {
            translated.push(result[0][i][0]);
        }

        return translated;
    } catch (e) {
        return translated;
    }
}

// 使用 DeepL API 进行翻译
async function translateWithDeepL(texts, sourceLang, targetLang) {
    let translated = [];
    let authKey = "YOUR_DEEPL_API_KEY"; // 请替换为你的 DeepL API 密钥
    let url = "https://api-free.deepl.com/v2/translate";

    for (let text of texts) {
        try {
            let response = await $httpClient.post({
                url: url,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `auth_key=${authKey}&text=${encodeURIComponent(text)}&source_lang=${sourceLang}&target_lang=${targetLang}`
            });

            if (response.error) {
                translated.push("");
                continue;
            }

            let data = JSON.parse(response.data);
            if (data.translations && data.translations.length > 0) {
                translated.push(data.translations[0].text);
            } else {
                translated.push("");
            }
        } catch (e) {
            translated.push("");
        }
    }

    return translated;
}
