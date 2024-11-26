// 基础配置
const CONFIG = {
    DEFAULT_SETTINGS: {
        Tubi: {
            type: "Google",    // 翻译引擎：Google, DeepL, Disable
            lang: "zh-CN",     // 目标语言
            sl: "auto",        // 源语言
            tl: "zh-CN",       // 目标语言
            line: "s",         // "s" 原文在上，翻译在下
            dkey: ""           // DeepL API key
        }
    },
    REGEX: {
        M3U8: /\.m3u8/,
        VTT: /\.vtt/,
        TIMELINE: /\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}\.\d{3}/,
        VTT_PATTERN: /#EXTINF:.+\n([^\n]+\.vtt)/
    }
};

// 存储管理类
class StorageManager {
    static save(key, value) {
        return $persistentStore.write(value, key);
    }

    static load(key) {
        return $persistentStore.read(key) || null;
    }

    static initializeSettings() {
        let settings = this.load("settings");
        if (!settings) {
            settings = CONFIG.DEFAULT_SETTINGS;
            this.save("settings", JSON.stringify(settings));
        } else {
            settings = JSON.parse(settings);
        }
        return settings;
    }
}

// VTT 处理类
class VTTProcessor {
    constructor(body) {
        this.body = body;
        this.lines = body.split("\n");
        this.timeline = [];
        this.subtitles = [];
    }

    parse() {
        if (!this.body || this.body.trim() === "") {
            throw new Error("VTT 内容为空");
        }

        let currentEntry = null;

        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i].trim();

            // 跳过 WEBVTT 头部
            if (line === "WEBVTT") continue;

            // 检测时间轴
            if (CONFIG.REGEX.TIMELINE.test(line)) {
                if (currentEntry) {
                    this.subtitles.push(currentEntry);
                }
                currentEntry = {
                    timeCode: line,
                    text: []
                };
            } else if (currentEntry && line !== "") {
                currentEntry.text.push(line);
            }
        }

        // 添加最后一个条目
        if (currentEntry) {
            this.subtitles.push(currentEntry);
        }

        if (this.subtitles.length === 0) {
            throw new Error("没有找到有效的字幕内容");
        }

        return this.subtitles;
    }

    static rebuild(subtitles, position = "s") {
        let result = "WEBVTT\n\n";
        
        for (const subtitle of subtitles) {
            result += subtitle.timeCode + "\n";
            if (position === "s") {
                // 原文在上，翻译在下
                result += subtitle.originalText.join("\n") + "\n";
                result += subtitle.translatedText.join("\n") + "\n\n";
            } else {
                // 翻译在上，原文在下
                result += subtitle.translatedText.join("\n") + "\n";
                result += subtitle.originalText.join("\n") + "\n\n";
            }
        }
        
        return result;
    }
}

// 翻译服务类
class TranslationService {
    static async translate(subtitles, engine, sl, tl, dkey) {
        const translatedSubtitles = [];
        
        for (const subtitle of subtitles) {
            const translatedEntry = {
                timeCode: subtitle.timeCode,
                originalText: subtitle.text,
                translatedText: []
            };

            // 翻译每一行文本
            for (const line of subtitle.text) {
                if (!line.trim()) {
                    translatedEntry.translatedText.push("");
                    continue;
                }

                try {
                    const translatedLine = await this._translateText(
                        line,
                        engine,
                        sl,
                        tl,
                        dkey
                    );
                    translatedEntry.translatedText.push(translatedLine);
                } catch (error) {
                    console.error(`翻译错误: "${line}":`, error);
                    translatedEntry.translatedText.push(line);
                }
            }

            translatedSubtitles.push(translatedEntry);
        }

        return translatedSubtitles;
    }

    static async _translateText(text, engine, sl, tl, dkey) {
        const options = this._getRequestOptions(text, engine, sl, tl, dkey);
        const response = await this._sendRequest(options);
        return this._parseResponse(response, engine);
    }

    static _getRequestOptions(text, engine, sl, tl, dkey) {
        if (engine === "Google") {
            return {
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
                method: "GET"
            };
        } else if (engine === "DeepL") {
            return {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `auth_key=${dkey}&text=${encodeURIComponent(text)}&target_lang=${tl}`
            };
        }
        throw new Error(`不支持的翻译引擎: ${engine}`);
    }

    static async _sendRequest(options) {
        return new Promise((resolve, reject) => {
            $task.fetch(options).then(
                response => {
                    try {
                        resolve(JSON.parse(response.body));
                    } catch (e) {
                        reject(new Error(`解析响应失败: ${e.message}`));
                    }
                },
                error => reject(new Error(`请求失败: ${error}`))
            );
        });
    }

    static _parseResponse(response, engine) {
        if (engine === "Google") {
            return response[0]?.[0]?.[0] || "";
        } else if (engine === "DeepL") {
            return response.translations?.[0]?.text || "";
        }
        throw new Error(`不支持的翻译引擎: ${engine}`);
    }
}

// 主脚本逻辑
async function main() {
    const url = $request.url;
    const settings = StorageManager.initializeSettings();
    const service = "Tubi";
    
    if (!settings[service]) {
        settings[service] = CONFIG.DEFAULT_SETTINGS[service];
    }
    
    const setting = settings[service];

    if (CONFIG.REGEX.M3U8.test(url)) {
        await handleM3U8File(url, settings, service);
    } else if (CONFIG.REGEX.VTT.test(url)) {
        await handleVTTFile(setting);
    } else {
        $done({});
    }
}

// 处理 M3U8 文件
async function handleM3U8File(url, settings, service) {
    console.log("处理 M3U8 文件...");
    const body = $response.body;
    
    const match = body.match(CONFIG.REGEX.VTT_PATTERN);
    if (match?.[1]) {
        const subtitlesUrl = url.replace(/\/[^\/]+$/, `/${match[1]}`);
        console.log("找到字幕 URL:", subtitlesUrl);
        settings[service].t_subtitles_url = subtitlesUrl;
        StorageManager.save("settings", JSON.stringify(settings));
    } else {
        console.log("未找到字幕文件链接");
    }

    $done({ body });
}

// 处理 VTT 文件
async function handleVTTFile(setting) {
    console.log("处理 VTT 文件...");
    
    if (setting.type === "Disable") {
        console.log("翻译已禁用，返回原始字幕");
        $done({ body: $response.body });
        return;
    }

    try {
        const vttProcessor = new VTTProcessor($response.body);
        const subtitles = vttProcessor.parse();
        console.log(`解析到 ${subtitles.length} 条字幕`);

        console.log("开始翻译字幕...");
        const translatedSubtitles = await TranslationService.translate(
            subtitles,
            setting.type,
            setting.sl,
            setting.tl,
            setting.dkey
        );
        console.log("字幕翻译完成");

        const result = VTTProcessor.rebuild(translatedSubtitles, setting.line);
        console.log("双语字幕生成完成");

        $done({ body: result });
    } catch (error) {
        console.error("处理 VTT 文件时出错:", error);
        $done({ body: $response.body });
    }
}

// 启动脚本
main().catch(error => {
    console.error("脚本执行失败:", error);
    $done({});
});
