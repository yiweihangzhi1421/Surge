/*
    Dualsub for Surge

        - 使用 Google 翻译，固定原始语言和翻译后语言设置
        - 选择翻译结果的位置（上面或下面）

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url;

// 固定设置
const originalLang = "auto"; // 原始语言
const translatedLang = "zh"; // 目标语言（中文）
const position = "below"; // 翻译结果位置: "above" 或 "below"

// 获取原始字幕 URL
let subtitles_url = getSubtitlesUrl(url);

if (!subtitles_url) {
    console.error("未找到字幕 URL");
    $done({});
}

// 从字幕 URL 获取原始字幕文本
send_request({ url: subtitles_url, method: "GET" })
    .then(originalSubtitles => {
        console.log("原始字幕获取成功:", originalSubtitles); // 调试输出

        // 构造 Google 翻译 URL
        let encodeSubtitles = encodeURIComponent(originalSubtitles);
        let translateUrl = `https://translate.google.com/?sl=${originalLang}&tl=${translatedLang}&text=${encodeSubtitles}&op=translate`;

        // 发送请求到 Google 翻译
        return send_request({ url: translateUrl, method: "GET" });
    })
    .then(translatedData => {
        // 调试输出，查看返回的 HTML
        console.log("翻译请求返回数据:", translatedData); // 调试输出

        // 从翻译网页中提取翻译结果
        let translatedSubtitles = extractTranslation(translatedData);
        console.log("翻译后的字幕:", translatedSubtitles); // 调试输出

        // 检查翻译结果是否有效
        if (translatedSubtitles === "翻译失败") {
            console.error("翻译结果提取失败。");
            $done({ body: originalSubtitles }); // 如果翻译失败，返回原始字幕
        } else {
            // 合并翻译内容与原字幕
            let body = position === "above" 
                ? mergeSubtitles(translatedSubtitles, originalSubtitles) 
                : mergeSubtitles(originalSubtitles, translatedSubtitles);
                
            $done({ body });
        }
    })
    .catch(error => {
        console.error("请求失败:", error);
        $done({});
    });

// 网络请求函数
function send_request(options) {
    return new Promise((resolve, reject) => {
        if (options.method === "GET") {
            $httpClient.get(options, (error, response, data) => {
                if (error) return reject(error);
                resolve(data); // 直接返回数据
            });
        }
    });
}

// 提取翻译结果的函数
function extractTranslation(html) {
    // 使用正则表达式提取翻译结果
    let match = html.match(/<span class="tlid-translation translation">(.*?)<\/span>/);
    if (match && match[1]) {
        return match[1].replace(/<[^>]*>/g, ''); // 移除任何 HTML 标签
    }
    return "翻译失败"; // 返回失败信息
}

// 合并字幕的函数
function mergeSubtitles(original, translated) {
    // 使用换行符合并原始字幕和翻译字幕
    return `${original}\n\n翻译:\n${translated}`;
}

// 获取字幕 URL 的函数
function getSubtitlesUrl(requestUrl) {
    // 假设字幕 URL 在请求 URL 中以特定格式出现
    let match = requestUrl.match(/(?:subtitles|timedtext)=(https?:\/\/[^&]+)/);
    
    if (match && match[1]) {
        return match[1]; // 返回提取的字幕 URL
    }
    
    // 如果没有找到字幕 URL，返回 null
    return null;
}
