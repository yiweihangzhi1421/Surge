// Configuration and constants
const CONFIG = {
    DEFAULT_SETTINGS: {
        Tubi: {
            type: "Google",
            lang: "English",
            sl: "auto",
            tl: "zh-CN",
            line: "s",
            dkey: "null"
        }
    },
    SETTINGS_KEY: "settings",
    VTT_HEADER: "WEBVTT\n\n"
};

// Storage utilities
class Storage {
    static save(key, value) {
        return $persistentStore.write(value, key);
    }

    static load(key) {
        return $persistentStore.read(key) || null;
    }
}

// Settings manager
class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        const stored = Storage.load(CONFIG.SETTINGS_KEY);
        if (!stored) {
            Storage.save(CONFIG.SETTINGS_KEY, JSON.stringify(CONFIG.DEFAULT_SETTINGS));
            return CONFIG.DEFAULT_SETTINGS;
        }
        return JSON.parse(stored);
    }

    getServiceSettings(service) {
        if (!this.settings[service]) {
            this.settings[service] = CONFIG.DEFAULT_SETTINGS[service];
            this.saveSettings();
        }
        return this.settings[service];
    }

    saveSettings() {
        Storage.save(CONFIG.SETTINGS_KEY, JSON.stringify(this.settings));
    }

    updateSubtitlesUrl(service, url) {
        this.settings[service].t_subtitles_url = url;
        this.saveSettings();
    }
}

// VTT parser and builder
class VTTHandler {
    static parse(content) {
        const lines = content.split("\n");
        const timelineRegex = /\d{2}:\d{2}.\d{3} --> \d{2}:\d{2}.\d{3}/;
        const timeline = [];
        const subtitles = [];

        for (let i = 0; i < lines.length; i++) {
            if (timelineRegex.test(lines[i])) {
                timeline.push(lines[i]);
                subtitles.push(lines[i + 1]?.trim() || "");
                i++;
            }
        }

        return { timeline, subtitles };
    }

    static rebuild(timeline, original, translated, lineOrder) {
        console.log("Rebuilding VTT with:", {
            timelineCount: timeline.length,
            originalCount: original.length,
            translatedCount: translated.length,
            lineOrder: lineOrder
        });
        
        let result = CONFIG.VTT_HEADER;
        for (let i = 0; i < timeline.length; i++) {
            result += `${timeline[i]}\n`;
            if (lineOrder === "s") {
                console.log(`Subtitle pair ${i + 1}:`, {
                    original: original[i],
                    translated: translated[i]
                });
                result += `${original[i]}\n${translated[i]}\n\n`;
            } else if (lineOrder === "f") {
                console.log(`Subtitle pair ${i + 1}:`, {
                    translated: translated[i],
                    original: original[i]
                });
                result += `${translated[i]}\n${original[i]}\n\n`;
            }
        }
        return result;
    }
}

// Translation service
class TranslationService {
    static async translate(subtitles, engine, sl, tl, apiKey) {
        const translators = {
            Google: this.googleTranslate,
            DeepL: this.deeplTranslate
        };

        const translator = translators[engine];
        if (!translator) {
            throw new Error(`Unsupported translation engine: ${engine}`);
        }

        const translated = [];
        for (const subtitle of subtitles) {
            if (!subtitle.trim()) {
                translated.push("");
                continue;
            }
            try {
                const text = await translator(subtitle, sl, tl, apiKey);
                translated.push(text);
            } catch (error) {
                console.error(`Translation error: ${error.message}`);
                translated.push(subtitle);
            }
        }
        return translated;
    }

    static async googleTranslate(text, sl, tl) {
        if (!text.trim()) return "";
        
        const constructUrl = (text, sl, tl) => {
            const baseUrl = "https://translate.googleapis.com/translate_a/single";
            const params = new URLSearchParams({
                client: "gtx",
                sl: sl,
                tl: tl,
                dt: "t",
                q: text
            });
            return `${baseUrl}?${params.toString()}`;
        };

        const url = constructUrl(text, sl, tl);
        const options = {
            url: url,
            method: "GET",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        console.log(`Translating text: "${text}" from ${sl} to ${tl}`);
        console.log("Google Translate URL:", url);
        
        try {
            const response = await this.sendRequest(options);
            console.log("Google Translate raw response:", JSON.stringify(response));
            
            if (response && Array.isArray(response[0])) {
                let translatedText = '';
                for (let i = 0; i < response[0].length; i++) {
                    if (response[0][i][0]) {
                        translatedText += response[0][i][0];
                    }
                }
                console.log(`Translation result: "${translatedText}"`);
                return translatedText || text;
            }
            console.log("Invalid response format, returning original text");
            return text;
        } catch (error) {
            console.error('Google translation error:', error);
            return text;
        }
    }
        } catch (error) {
            console.error('Google translation error:', error);
            return text;
        }
    }

    static async deeplTranslate(text, sl, tl, apiKey) {
        if (!text.trim()) return "";
        if (!apiKey || apiKey === "null") {
            throw new Error("DeepL API key is required");
        }
        
        const options = {
            url: "https://api-free.deepl.com/v2/translate",
            method: "POST",
            headers: { 
                "Authorization": `DeepL-Auth-Key ${apiKey}`,
                "Content-Type": "application/x-www-form-urlencoded" 
            },
            body: `text=${encodeURIComponent(text)}&target_lang=${tl}`
        };
        
        try {
            const response = await this.sendRequest(options);
            if (response && response.translations && response.translations.length > 0) {
                return response.translations[0].text || text;
            }
            return text;
        } catch (error) {
            console.error('DeepL translation error:', error);
            return text;
        }
    }

    static async sendRequest(options) {
        try {
            const response = await $task.fetch(options);
            // 检查响应状态
            if (!response.status || response.status < 200 || response.status >= 300) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            try {
                return JSON.parse(response.body);
            } catch (e) {
                console.error('Failed to parse response:', e);
                throw new Error('Invalid JSON response');
            }
        } catch (error) {
            console.error(`Request failed: ${error.message}`);
            throw error;
        }
    }
}

// Main handler
class SubtitleHandler {
    constructor(url, body) {
        this.url = url;
        this.body = body;
        this.settingsManager = new SettingsManager();
    }

    async process() {
        if (this.url.match(/\.m3u8/)) {
            return this.processM3U8();
        }
        if (this.url.match(/\.vtt/)) {
            return this.processVTT();
        }
        throw new Error("Unsupported file type");
    }

    processM3U8() {
        console.log("Processing .m3u8 file...");
        const patt = /#EXTINF:.+\n([^\n]+\.vtt)/;
        const match = this.body.match(patt);

        if (match?.[1]) {
            const subtitlesUrl = this.url.replace(/\/[^\/]+$/, `/${match[1]}`);
            console.log("Extracted subtitles URL:", subtitlesUrl);
            this.settingsManager.updateSubtitlesUrl("Tubi", subtitlesUrl);
        } else {
            console.error("Failed to extract subtitles URL from .m3u8 file");
        }

        return { body: this.body };
    }

    async processVTT() {
        console.log("Processing .vtt file...");
        const setting = this.settingsManager.getServiceSettings("Tubi");
        
        // 添加设置检查日志
        console.log("Current settings:", JSON.stringify({
            type: setting.type,
            lang: setting.lang,
            sl: setting.sl,
            tl: setting.tl,
            line: setting.line
        }, null, 2));

        if (setting.type === "Disable") {
            console.log("Translation disabled");
            return { body: this.body };
        }

        if (!this.body?.trim()) {
            console.error("Empty .vtt file content");
            return { body: this.body };
        }

        const { timeline, subtitles } = VTTHandler.parse(this.body);
        
        if (!timeline.length || !subtitles.length) {
            console.error("Failed to parse .vtt file");
            return { body: this.body };
        }

        try {
            const translated = await TranslationService.translate(
                subtitles,
                setting.type,
                setting.sl,
                setting.tl,
                setting.dkey
            );

            const translatedBody = VTTHandler.rebuild(
                timeline,
                subtitles,
                translated,
                setting.line
            );

            return { body: translatedBody };
        } catch (error) {
            console.error("Translation failed:", error);
            return { body: this.body };
        }
    }
}

// Main execution
async function main() {
    try {
        const handler = new SubtitleHandler($request.url, $response.body);
        const result = await handler.process();
        $done(result);
    } catch (error) {
        console.error("Error in main execution:", error);
        $done({ body: $response.body });
    }
}

main();
