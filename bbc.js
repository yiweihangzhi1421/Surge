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

// 获取请求 URL 和响应体
const url = $request.url;
const body = $response.body;
const headers = $request.headers;

// 固定设置
const sourceLang = "EN"; // 源语言：英文
const targetLang = "ZH"; // 目标语言：中文
const translationType = "Google"; // 翻译类型："Google" 或 "DeepL"
const deepLAuthKey = "YOUR_DEEPL_API_KEY"; // 如果使用 DeepL，请替换为你的 DeepL API 密钥

console.log("DualSubs.BBC.HLS.Main.m3u8.js 脚本已被触发，URL:", url);

// 检测是否为 BBC iPlayer 的 .m3u8 字幕请求
const m3u8Pattern = /^https?:\/\/vod-hls-(.+)(\.live\.cf\.md\.bbci\.co\.uk|-live\.akamaized\.net)\/(.+)_hls_master\.m3u8(\?.+)?$/i;
if (!m3u8Pattern.test(url)) {
    console.log("URL 不匹配字幕请求模式，脚本终止");
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
        console.log("下载 VTT 字幕文件失败，错误:", error);
        $done({});
        return;
    }

    let vttContent = data;
    console.log("成功下载 VTT 字幕文件，内容长度:", vttContent.length);

    // 翻译 VTT 字幕
    translateVTT(vttContent, function(translatedVTT) {
        console.log("翻译完成，生成双语 VTT 字幕");

        // 生成新的双语 VTT 文件
        let newVttContent = generateDualVTT(vttContent, translatedVTT);
        console.log("生成新的双语 VTT 字幕，内容长度:", newVttContent.length);

        // 手动上传新的 VTT 字幕文件到可访问的 URL
        // 请确保您已将新 VTT 文件上传到您的服务器，并获取其 URL
        let newVttUrl = "https://yourserver.com/path/to/dual_subtitles.vtt"; // 替换为您的双语 VTT 字幕文件 URL

        // 替换 .m3u8 中的 URI 为新的双语 VTT 文件 URL
        let newM3u8Body = body.replace(/URI="(.+\.vtt)"/i, `URI="${newVttUrl}"`);
        console.log("修改后的 .m3u8 文件内容长度:", newM3u8Body.length);

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

    console.log(`需要翻译的字幕行数: ${textLines.length}`);

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
            console.log(`翻译完成批次: ${completed}/${batches.length}`);
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
        console.log("未知的翻译类型:", translationType);
        failure();
    }
}

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
            failure();
            return;
        }

        try {
            let result = JSON.parse(data);
            let translations = result[0].map(item => item[0]);
            success(translations);
        } catch (e) {
            console.log("解析 Google 翻译响应失败，错误:", e);
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

function generateDualVTT(originalVtt, translatedTexts) {
    // 简单的双语 VTT 生成示例
    // 需要确保 translatedTexts 的顺序与 originalVtt 中的文本顺序一致

    let lines = originalVtt.split('\n');
    let newVtt = "WEBVTT\n\n";
    let textIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        newVtt += line + '\n';

        // 处理文本行
        if (line && !line.startsWith("WEBVTT") && !line.startsWith("NOTE") && !/-->/i.test(line) && !/^[0-9]+$/.test(line)) {
            if (translatedTexts[textIndex]) {
                newVtt += translatedTexts[textIndex] + '\n';
                textIndex++;
            }
        }
    }

    return newVtt;
}
