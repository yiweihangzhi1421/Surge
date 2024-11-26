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
            timeout: 5000      // 请求超时时间（毫秒）
        }
    },
    REGEX: {
        M3U8: /\.m3u8/,
        VTT: /\.vtt/,
        TIMELINE: /\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}\.\d{3}/,
        VTT_PATTERN: /#EXTINF:.+\n([^\n]+\.vtt)/
    },
    MAX_RETRY: 3,           // 最大重试次数
    RETRY_DELAY: 1000,      // 重试延迟（毫秒）
    BATCH_SIZE: 5           // 批量处理字幕的数量
};

// 错误处理类
class SubtitleError extends Error {
    constructor(message, type) {
        super(message);
        this.name = 'SubtitleError';
        this.type = type;
    }
}

// VTT 处理类
class VTTProcessor {
    constructor(body) {
        this.body = body;
        this.lines = body.split("\n");
        this.subtitles = [];
    }

    parse() {
        try {
            if (!this.body?.trim()) {
                throw new SubtitleError("VTT 内容为空", "EMPTY_CONTENT");
            }

            let currentEntry = null;

            for (const line of this.lines) {
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

            if (!this.subtitles.length) {
                throw new SubtitleError("没有找到有效的字幕内容", "NO_SUBTITLES");
            }

            return this.subtitles;
        } catch (error) {
            console.error("解析 VTT 失败:", error);
            throw error;
        }
    }

    static shouldTranslate(text) {
        if (!text || typeof text !== 'string') return false;
        // 不翻译音乐标记和音效
        if (/^\([^)]+\)$/.test(text)) return false;
        // 不翻译空行或只有特殊字符的行
        return !!text.replace(/[♪()]/g, '').trim();
    }

    static cleanText(text) {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
    }

    static rebuild(subtitles, position = "s") {
        try {
            let result = "WEBVTT\n\n";
            
            for (const subtitle of subtitles) {
                if (!subtitle?.timeCode) continue;

                result += subtitle.timeCode + "\n";
                
                const originalTexts = subtitle.originalText || subtitle.text || [];
                
                for (let i = 0; i < originalTexts.length; i++) {
                    const originalLine = originalTexts[i] || '';
                    const translatedLine = subtitle.translatedText?.[i] || '';
                    
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
        } catch (error) {
            console.error("重建 VTT 失败:", error);
            throw new SubtitleError("重建字幕失败", "REBUILD_ERROR");
        }
    }
}

// 翻译服务类
class TranslationService {
    static async translate(subtitles, engine, sl, tl, dkey) {
        const translatedSubtitles = [];
        const batchSize = CONFIG.BATCH_SIZE;
        
        for (let i = 0; i < subtitles.length; i += batchSize) {
            const batch = subtitles.slice(i, i + batchSize);
            const batchPromises = batch.map(subtitle => this._translateSubtitle(
                subtitle, engine, sl, tl, dkey
            ));
            
            const results = await Promise.all(batchPromises);
            translatedSubtitles.push(...results);
        }

        return translatedSubtitles;
    }

    static async _translateSubtitle(subtitle, engine, sl, tl, dkey) {
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

            let translatedLine = "";
            let retryCount = 0;

            while (retryCount < CONFIG.MAX_RETRY) {
                try {
                    translatedLine = await this._translateTextWithTimeout(
                        cleanedText,
                        engine,
                        sl,
                        tl,
                        dkey
                    );
                    break;
                } catch (error) {
                    retryCount++;
                    if (retryCount === CONFIG.MAX_RETRY) {
                        console.error(`翻译失败 (${retryCount}次重试): "${cleanedText}"`, error);
                        translatedLine = "";
                    } else {
                        await new Promise(resolve => 
                            setTimeout(resolve, CONFIG.RETRY_DELAY)
                        );
                    }
                }
            }

            translatedEntry.translatedText.push(translatedLine);
        }

        return translatedEntry;
    }

    static async _translateTextWithTimeout(text, engine, sl, tl, dkey) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('翻译请求超时')), 
                CONFIG.DEFAULT_SETTINGS.Tubi.timeout
            );
        });

        const translatePromise = this._translateText(text, engine, sl, tl, dkey);
        return Promise.race([translatePromise, timeoutPromise]);
    }

    static _getRequestOptions(text, engine, sl, tl, dkey) {
        if (engine === "Google") {
            return {
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
                method: "GET",
                timeout: CONFIG.DEFAULT_SETTINGS.Tubi.timeout
            };
        } else if (engine === "DeepL") {
            return {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `auth_key=${dkey}&text=${encodeURIComponent(text)}&target_lang=${tl}`,
                timeout: CONFIG.DEFAULT_SETTINGS.Tubi.timeout
            };
        }
        throw new SubtitleError(`不支持的翻译引擎: ${engine}`, "UNSUPPORTED_ENGINE");
    }
}

// 主处理函数
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
        // 出错时返回原始字幕
        $done({ body: $response.body });
    }
}
