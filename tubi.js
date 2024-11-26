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
            // 确保每个字幕块都包含时间码
            result += subtitle.timeCode + "\n";
            
            // 根据字幕位置设置（s: 原文在上，翻译在下；t: 翻译在上，原文在下）
            if (position === "s") {
                // 添加英文原文（只取第一行）
                result += subtitle.originalText[0] + "\n";
                // 添加中文翻译（只取第一行）
                if (subtitle.translatedText && subtitle.translatedText.length > 0) {
                    result += subtitle.translatedText[0] + "\n";
                }
            } else {
                // 添加中文翻译（只取第一行）
                if (subtitle.translatedText && subtitle.translatedText.length > 0) {
                    result += subtitle.translatedText[0] + "\n";
                }
                // 添加英文原文（只取第一行）
                result += subtitle.originalText[0] + "\n";
            }
            
            // 添加空行分隔不同的字幕块
            result += "\n";
        }
        
        return result;
    }
}

// 翻译服务类保持不变...

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
