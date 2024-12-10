/*
    DualSubs.BBC.HLS.Main.m3u8.js

    功能:
    - 拦截 BBC iPlayer 的 HLS (.m3u8) 字幕请求
    - 解析并下载 VTT 字幕文件
    - 翻译英文字幕为中文
    - 生成双语 VTT 字幕，中文字幕在上，英文在下
    - 返回修改后的 .m3u8 文件，指向新的双语 VTT 字幕

    作者:
    - 您的名字或联系方式
*/

const url = $request.url;
const headers = $request.headers;

// 固定设置
const sourceLang = "EN"; // 源语言：英文
const targetLang = "ZH"; // 目标语言：中文
const translationType = "Google"; // 翻译类型："Google" 或 "DeepL"
const deepLAuthKey = "YOUR_DEEPL_API_KEY"; // 如果使用 DeepL，请替换为你的 DeepL API 密钥

// 检测是否为 BBC iPlayer 的 .m3u8 字幕请求
const m3u8Pattern = /^https?:\/\/vod-hls-(.+)(\.live\.cf\.md\.bbci\.co\.uk|-live\.akamaized\.net)\/(.+)_hls_master\.m3u8(\?.+)?$/i;
if (!m3u8Pattern.test(url)) {
    $done({});
}

// 获取响应体
let body = $response.body;

// 如果响应体为空，结束
if (!body) {
    $done({});
}

// 解析 .m3u8 文件，找到 VTT 字幕文件 URL
let vttUrlMatch = body.match(/URI="(.+\.vtt)"/i);
if (!vttUrlMatch || vttUrlMatch.length < 2) {
    console.log("未找到 VTT 字幕文件的 URL");
    $done({});
}

let vttUrl = vttUrlMatch[1];
if (!vttUrl.startsWith("http")) {
    // 处理相对路径
    let baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    vttUrl = baseUrl + vttUrl;
}

console.log("找到 VTT 字幕文件的 URL:", vttUrl);

// 下载 VTT 字幕文件
$httpClient.get({
    url: vttUrl,
    headers: headers
}, function(error, response, data) {
    if (error || response.status !== 200) {
        console.log("下载 VTT 字幕文件失败");
        $done({});
        return;
    }

    let vttContent = data;

    // 翻译 VTT 字幕
    translateVTT(vttContent, function(translatedVTT) {
        // 生成新的双语 VTT 文件
        let newVttContent = generateDualVTT(vttContent, translatedVTT);
        
        // 上传新的 VTT 字幕文件到可访问的 URL
        // 注意：Surge 不支持动态上传文件，因此需要您自行托管新的 VTT 文件，并更新 .m3u8 中的 URI
        // 这里假设您已将新 VTT 文件上传到某个 URL
        let newVttUrl = "https://yourserver.com/path/to/dual_subtitles.vtt"; // 替换为您的双语 VTT 文件 URL

        // 替换 .m3u8 中的 URI 为新的双语 VTT 文件 URL
        let newM3u8Body = body.replace(/URI="(.+\.vtt)"/i, `URI="${newVttUrl}"`);

        // 返回修改后的 .m3u8 文件
        $done({ body: newM3u8Body });
    }, function() {
        console.log("翻译 VTT 字幕失败");
        $done({});
    });
});

function translateVTT(vttContent, success, failure) {
    // 提取 VTT 字幕中的文本
    let lines = vttContent.split('\n');
    let textLines = [];
    for (let line of lines) {
        if (line.trim() === "" || line.startsWith("WEBVTT") || line.startsWith("NOTE") || /^[0-9]+$/.test(line)) {
            continue;
        }
        if (/-->/i.test(line)) {
            continue;
        }
        textLines.push(line);
    }

    if (textLines.length === 0) {
        console.log("没有找到需要翻译的字幕文本");
        failure();
        return;
    }

    // 分批翻译
    let batchSize = 50; // 根据需要调整
    let batches = [];
    for (let i = 0; i < textLines.length; i += batchSize) {
        batches.push(textLines.slice(i, i + batchSize));
    }

    let translatedTexts = [];
    let completed = 0;

    for (let batch of batches) {
        translateBatch(batch, function(translatedBatch) {
            translatedTexts = translatedTexts.concat(translatedBatch);
            completed++;
            if (completed === batches.length) {
                success(translatedTexts);
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
            console.log("Google 翻译请求失败");
            failure();
            return;
        }

        try {
            let result = JSON.parse(data);
            let translations = result[0].map(item => item[0]);
            success(translations);
        } catch (e) {
            console.log("解析 Google 翻译响应失败");
            failure();
        }
    });
}

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

function generateDualVTT(originalVtt, translatedVtt) {
    // 简单的双语 VTT 生成示例
    // 实际情况可能需要更复杂的时间轴对齐和格式处理

    let originalLines = originalVtt.split('\n');
    let translatedLines = translatedVtt.join('\n').split('\n');

    let newVtt = "WEBVTT\n\n";

    let translatedIndex = 0;
    for (let line of originalLines) {
        newVtt += line + '\n';
        if (line.match(/-->/)) {
            if (translatedIndex < translatedLines.length) {
                newVtt += translatedLines[translatedIndex] + '\n';
                translatedIndex++;
            }
        }
    }

    return newVtt;
}
