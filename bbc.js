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

// 固定设置
const sourceLang = "EN"; // 源语言：英文
const targetLang = "ZH"; // 目标语言：中文
const translationType = "Google"; // 翻译类型："Google" 或 "DeepL"
const deepLAuthKey = "YOUR_DEEPL_API_KEY"; // 如果使用 DeepL，请替换为你的 DeepL API 密钥

// 检测是否为 BBC iPlayer 的字幕请求
if (!/^https:\/\/vod-sub-uk-live\.akamaized\.net\/iplayer\/subtitles\/ng\/modav\/.+\.xml$/i.test(url)) {
    $done({});
}

// 获取响应体
let body = $response.body;

// 如果响应体为空，结束
if (!body) {
    $done({});
}

// 处理 TTML 字幕
handleTTML(body);

function handleTTML(body) {
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
    translateBatches(batches, function(translated) {
        translatedTexts = translated;
        // 插入翻译后的文本
        insertTranslations(xmlDoc, paragraphs, translatedTexts);
    }, function(error) {
        // 出现错误时，直接返回原始字幕
        $done({});
    });
}

function translateBatches(batches, success, failure) {
    let translated = [];
    let completed = 0;

    for (let i = 0; i < batches.length; i++) {
        translateBatch(batches[i], function(batchTranslated) {
            translated = translated.concat(batchTranslated);
            completed++;
            if (completed === batches.length) {
                success(translated);
            }
        }, function() {
            failure();
        });
    }
}

function translateBatch(batch, success, failure) {
    if (translationType === "Google") {
        translateWithGoogle(batch, success, failure);
    } else if (translationType === "DeepL") {
        translateWithDeepL(batch, success, failure);
    } else {
        failure();
    }
}

function translateWithGoogle(texts, success, failure) {
    let query = texts.join("\n");
    let translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(query)}`;

    $httpClient.get({
        url: translateUrl,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    }, function(error, response, data) {
        if (error || response.status !== 200) {
            failure();
            return;
        }

        try {
            let result = JSON.parse(data);
            let translations = result[0].map(item => item[0]);
            success(translations);
        } catch (e) {
            failure();
        }
    });
}

function translateWithDeepL(texts, success, failure) {
    let translated = [];
    let remaining = texts.length;

    for (let i = 0; i < texts.length; i++) {
        let text = texts[i];
        let translateUrl = "https://api-free.deepl.com/v2/translate";

        $httpClient.post({
            url: translateUrl,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: `auth_key=${deepLAuthKey}&text=${encodeURIComponent(text)}&source_lang=${sourceLang}&target_lang=${targetLang}`
        }, function(error, response, data) {
            if (error || response.status !== 200) {
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

function insertTranslations(xmlDoc, paragraphs, translatedTexts) {
    for (let i = 0; i < paragraphs.length; i++) {
        let originalText = paragraphs[i].textContent.trim();
        if (originalText.length > 0 && translatedTexts[i]) {
            // 创建 <span> 标签用于中文字幕
            let chineseSpan = xmlDoc.createElement("span");
            chineseSpan.textContent = translatedTexts[i];
            // 插入 <br/> 标签
            let br = xmlDoc.createElement("br");
            // 插入到原有内容之前
            paragraphs[i].insertBefore(br, paragraphs[i].firstChild);
            paragraphs[i].insertBefore(chineseSpan, br.nextSibling);
        }
    }

    // 序列化回 XML
    let serializer = new XMLSerializer();
    let newBody = serializer.serializeToString(xmlDoc);

    // 返回修改后的 TTML
    $done({ body: newBody });
}
