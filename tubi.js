// 默认设置
let settings = {
    Tubi: {
        type: "Google", // 翻译服务: Google, DeepL, 或 Disable
        targetLanguage: "zh-CN", // 目标语言 (中文)
        lineMerge: "dual", // 双语显示: dual (双语), single (仅翻译), original (仅原始字幕)
    }
};

let service = "Tubi"; // 当前服务
let url = $request.url;

// 处理 `.m3u8` 文件
if (url.match(/\.m3u8$/)) {
    $httpClient.get(url, function (error, response, body) {
        if (error) {
            console.log("m3u8 文件请求错误: ", error);
            $done({});
            return;
        }
        // 保留 `.m3u8` 原始内容，不做修改
        $done({ body });
    });
}

// 处理 `.vtt` 文件
if (url.match(/\.vtt$/)) {
    $httpClient.get(url, function (error, response, body) {
        if (error) {
            console.log("字幕文件请求错误: ", error);
            $done({});
            return;
        }

        // 检查是否需要翻译
        if (settings[service].type === "Google") {
            translateSubtitles(body, settings[service].targetLanguage, function (translatedSubtitles) {
                // 合并原始字幕和翻译后的字幕
                let combinedSubtitles = mergeSubtitles(body, translatedSubtitles, settings[service].lineMerge);
                $done({ body: combinedSubtitles });
            });
        } else {
            // 如果禁用翻译，直接返回原始字幕
            $done({ body });
        }
    });
}

// 翻译字幕内容
function translateSubtitles(vttContent, targetLanguage, callback) {
    let sentences = extractSentences(vttContent);
    if (sentences.length === 0) {
        console.log("未提取到字幕内容");
        callback([]);
        return;
    }

    // Google Translate API
    let apiUrl =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
        targetLanguage +
        "&dt=t&q=" +
        encodeURIComponent(sentences.join("\n"));

    $httpClient.get(apiUrl, function (error, response, data) {
        if (error) {
            console.log("翻译请求错误: ", error);
            callback([]);
            return;
        }

        try {
            let translation = JSON.parse(data);
            let translatedSentences = translation[0].map((item) => item[0]);
            callback(translatedSentences);
        } catch (e) {
            console.log("翻译结果解析错误: ", e);
            callback([]);
        }
    });
}

// 合并原始字幕和翻译字幕
function mergeSubtitles(originalSubtitles, translatedSubtitles, lineMerge) {
    let lines = originalSubtitles.split("\n");
    let mergedSubtitles = "WEBVTT\n\n";
    let index = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/)) {
            // 时间轴
            mergedSubtitles += lines[i] + "\n";
            // 原始字幕
            let originalLine = lines[i + 1];
            let translatedLine = translatedSubtitles[index] || "";
            if (lineMerge === "dual") {
                mergedSubtitles += originalLine + "\n" + translatedLine + "\n";
            } else if (lineMerge === "single") {
                mergedSubtitles += translatedLine + "\n";
            } else {
                mergedSubtitles += originalLine + "\n";
            }
            index++;
            i++; // 跳过下一行原始字幕
        } else {
            mergedSubtitles += lines[i] + "\n";
        }
    }

    return mergedSubtitles;
}

// 提取字幕中的内容
function extractSentences(vttContent) {
    let lines = vttContent.split("\n");
    let sentences = [];

    for (let line of lines) {
        if (
            !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/) &&
            line.trim() !== "" &&
            !line.startsWith("WEBVTT")
        ) {
            sentences.push(line.trim());
        }
    }

    return sentences;
}
