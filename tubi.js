// 基础配置
const CONFIG = {
    DEFAULT_SETTINGS: {
        Tubi: {
            type: "Google",    // 翻译引擎：Google, DeepL, Disable
            lang: "zh-CN",     // 目标语言
            sl: "auto",        // 源语言
            tl: "zh-CN",       // 目标语言
            line: "s",         // "s" 原文在上，翻译在下
            dkey: "",          // DeepL API key
            timeout: 2000      // 请求超时时间（毫秒）
        }
    },
    REGEX: {
        M3U8: /\.m3u8/,
        VTT: /\.vtt/,
        TIMELINE: /\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}\.\d{3}/,
        VTT_PATTERN: /#EXTINF:.+\n([^\n]+\.vtt)/,
        MUSIC: /^\([^)]+\)$/,
        WHITESPACE: /\s+/g
    },
    BATCH_SIZE: 2,           // 批处理大小
    MAX_ATTEMPTS: 1          // 最大尝试次数
};

// 存储管理类
class StorageManager {
    static save(key, value) {
        try {
            return $persistentStore.write(value, key);
        } catch (error) {
            console.error('存储失败:', error);
            return false;
        }
    }

    static load(key) {
        try {
            return $persistentStore.read(key) || null;
        } catch (error) {
            console.error('读取失败:', error);
            return null;
        }
    }

    static initializeSettings() {
        let settings = this.load("settings");
        if (!settings) {
            settings = CONFIG.DEFAULT_SETTINGS;
            this.save("settings", JSON.stringify(settings));
        } else {
            try {
                settings = JSON.parse(settings);
            } catch {
                settings = CONFIG.DEFAULT_SETTINGS;
                this.save("settings", JSON.stringify(settings));
            }
        }
        return settings;
    }
}

// 翻译服务类
class TranslationService {
    static async translateText(text, engine, sl, tl, dkey) {
        if (engine === "Google") {
            return this._googleTranslate(text, sl, tl);
        } else if (engine === "DeepL") {
            return this._deeplTranslate(text, tl, dkey);
        }
        throw new Error(`不支持的翻译引擎: ${engine}`);
    }

    static async _googleTranslate(text, sl, tl) {
        const options = {
            url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
            method: "GET",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36'
            }
        };

        return this._makeRequest(options);
    }

    static async _deeplTranslate(text, tl, dkey) {
        const options = {
            url: "https://api-free.deepl.com/v2/translate",
            method: "POST",
            headers: { 
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `DeepL-Auth-Key ${dkey}`
            },
            body: `text=${encodeURIComponent(text)}&target_lang=${tl}`
        };

        return this._makeRequest(options, true);
    }

    static async _makeRequest(options, isDeepL = false) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
                () => reject(new Error('请求超时')), 
                CONFIG.DEFAULT_SETTINGS.Tubi.timeout
            );

            $task.fetch(options).then(
                response => {
                    clearTimeout(timeoutId);
                    try {
                        const result = JSON.parse(response.body);
                        if (isDeepL) {
                            resolve(result.translations?.[0]?.text || "");
                        } else {
                            resolve(result[0]?.[0]?.[0] || "");
                        }
                    } catch {
                        reject(new Error('解析响应失败'));
                    }
                },
                error => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            );
        });
    }
}

// VTT 处理类
class VTTProcessor {
    constructor(body) {
        // 处理二进制数据
        if (body instanceof Uint8Array) {
            this.body = new TextDecoder('utf-8').decode(body);
        } else {
            this.body = body;
        }
        this.subtitles = [];
    }

    parse() {
        if (!this.body?.trim()) {
            throw new Error("VTT 内容为空");
        }

        const lines = this.body.split("\n");
        let currentEntry = null;

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine === "WEBVTT") continue;

            if (CONFIG.REGEX.TIMELINE.test(trimmedLine)) {
                if (currentEntry) {
                    this.subtitles.push(currentEntry);
                }
                currentEntry = {
                    timeCode: trimmedLine,
                    text: []
                };
            } else if (currentEntry && trimmedLine) {
                currentEntry.text.push(trimmedLine);
            }
        }

        if (currentEntry) {
            this.subtitles.push(currentEntry);
        }

        return this.subtitles;
    }

    static shouldTranslate(text) {
        if (!text || typeof text !== 'string') return false;
        // 跳过音乐标记和音效
        if (CONFIG.REGEX.MUSIC.test(text)) return false;
        // 跳过空行或只有特殊字符的行
        const cleaned = text.replace(/[♪()]/g, '').trim();
        return cleaned.length > 0;
    }

    static cleanText(text) {
        if (!text) return '';
        return text.replace(CONFIG.REGEX.WHITESPACE, ' ').trim();
    }

    async translate(setting) {
        const translatedSubtitles = [];
        
        for (let i = 0; i < this.subtitles.length; i += CONFIG.BATCH_SIZE) {
            const batch = this.subtitles.slice(i, i + CONFIG.BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(subtitle => this._translateSubtitle(subtitle, setting))
            );
            translatedSubtitles.push(...batchResults);
        }

        return translatedSubtitles;
    }

    async _translateSubtitle(subtitle, setting) {
        const translatedEntry = {
            timeCode: subtitle.timeCode,
            originalText: subtitle.text,
            translatedText: []
        };

        for (const line of subtitle.text) {
            if (!VTTProcessor.shouldTranslate(line)) {
                translatedEntry.translatedText.push("");
                continue;
            }

            const cleanedText = VTTProcessor.cleanText(line);
            if (!cleanedText) {
                translatedEntry.translatedText.push("");
                continue;
            }

            try {
                const translatedLine = await TranslationService.translateText(
                    cleanedText,
                    setting.type,
                    setting.sl,
                    setting.tl,
                    setting.dkey
                );
                translatedEntry.translatedText.push(translatedLine);
            } catch {
                translatedEntry.translatedText.push("");
            }
        }

        return translatedEntry;
    }

    static rebuild(subtitles, position = "s") {
        let result = "WEBVTT\n\n";
        
        for (const subtitle of subtitles) {
            if (!subtitle?.timeCode) continue;

            result += subtitle.timeCode + "\n";
            
            const originalTexts = subtitle.originalText || [];
            const translatedTexts = subtitle.translatedText || [];
            
            for (let i = 0; i < originalTexts.length; i++) {
                const originalLine = originalTexts[i];
                const translatedLine = translatedTexts[i];
                
                if (position === "s") {
                    result += originalLine + "\n";
                    if (this.shouldTranslate(originalLine) && translatedLine) {
                        result += translatedLine + "\n";
                    }
                } else {
                    if (this.shouldTranslate(originalLine) && translatedLine) {
                        result += translatedLine + "\n";
                    }
                    result += originalLine + "\n";
                }
            }
            
            result += "\n";
        }
        
        return result;
    }
}

// M3U8文件处理函数
async function handleM3U8File(url, settings, service) {
    try {
        const body = $response.body;
        const match = body.match(CONFIG.REGEX.VTT_PATTERN);
        
        if (match?.[1]) {
            const subtitlesUrl = url.replace(/\/[^\/]+$/, `/${match[1]}`);
            settings[service].t_subtitles_url = subtitlesUrl;
            StorageManager.save("settings", JSON.stringify(settings));
        }

        $done({ body });
    } catch (error) {
        console.error("M3U8处理失败:", error);
        $done({ body: $response.body });
    }
}

// VTT文件处理函数
async function handleVTTFile(setting) {
    try {
        if (setting.type === "Disable") {
            $done({ body: $response.body });
            return;
        }

        let responseBody = $response.body;
        
        // 检查并处理二进制数据
        const contentType = ($response.headers['Content-Type'] || '').toLowerCase();
        if (contentType.includes('octet-stream')) {
            if (responseBody instanceof Uint8Array) {
                responseBody = new TextDecoder('utf-8').decode(responseBody);
            }
        }

        const processor = new VTTProcessor(responseBody);
        const subtitles = processor.parse();
        const translatedSubtitles = await processor.translate(setting);
        const result = VTTProcessor.rebuild(translatedSubtitles, setting.line);

        // 返回结果时设置正确的 Content-Type
        $done({ 
            body: result,
            headers: {
                ...$response.headers,
                'Content-Type': 'text/vtt;charset=utf-8'
            }
        });
    } catch (error) {
        console.error("VTT处理失败:", error);
        $done({
            body: $response.body,
            headers: $response.headers
        });
    }
}

// 主函数
async function main() {
    try {
        const url = $request.url;
        const settings = StorageManager.initializeSettings();
        const service = "Tubi";
        
        if (!settings[service]) {
            settings[service] = CONFIG.DEFAULT_SETTINGS[service];
        }
        
        if (CONFIG.REGEX.M3U8.test(url)) {
            await handleM3U8File(url, settings, service);
        } else if (CONFIG.REGEX.VTT.test(url)) {
            await handleVTTFile(settings[service]);
        } else {
            $done({});
        }
    } catch (error) {
        console.error("执行失败:", error);
        $done({});
    }
}

// 启动脚本
main();
