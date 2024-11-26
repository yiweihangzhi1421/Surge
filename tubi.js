// Configuration Constants
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
    REGEX: {
        M3U8: /\.m3u8/,
        VTT: /\.vtt/,
        TIMELINE: /\d{2}:\d{2}.\d{3} --> \d{2}:\d{2}.\d{3}/,
        VTT_PATTERN: /#EXTINF:.+\n([^\n]+\.vtt)/
    },
    TRANSLATION_ENGINES: {
        GOOGLE: "Google",
        DEEPL: "DeepL",
        DISABLE: "Disable"
    }
};

// Storage Management
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

// VTT File Handler
class VTTHandler {
    constructor(body) {
        this.body = body;
        this.lines = body.split("\n");
        this.timeline = [];
        this.subtitles = [];
    }

    parse() {
        if (!this.body || this.body.trim() === "") {
            throw new Error("Empty VTT content");
        }

        for (let i = 0; i < this.lines.length; i++) {
            if (CONFIG.REGEX.TIMELINE.test(this.lines[i])) {
                this.timeline.push(this.lines[i]);
                this.subtitles.push(this.lines[i + 1]?.trim() || "");
                i++;
            }
        }

        if (this.timeline.length === 0 || this.subtitles.length === 0) {
            throw new Error("Failed to parse VTT content");
        }

        return {
            timeline: this.timeline,
            subtitles: this.subtitles
        };
    }

    static rebuild(timeline, original, translated, line) {
        let result = "WEBVTT\n\n";
        for (let i = 0; i < timeline.length; i++) {
            result += `${timeline[i]}\n`;
            if (line === "s") {
                result += `${original[i]}\n${translated[i]}\n\n`;
            } else if (line === "f") {
                result += `${translated[i]}\n${original[i]}\n\n`;
            }
        }
        return result;
    }
}

// Translation Service
class TranslationService {
    static async translate(subtitles, engine, sl, tl, dkey) {
        const translated = [];
        
        for (let i = 0; i < subtitles.length; i++) {
            if (subtitles[i].trim() === "") {
                translated.push("");
                continue;
            }

            try {
                const result = await this._translateText(subtitles[i], engine, sl, tl, dkey);
                translated.push(result);
            } catch (error) {
                console.error(`Translation error for text "${subtitles[i]}":`, error);
                translated.push(subtitles[i]);
            }
        }

        return translated;
    }

    static async _translateText(text, engine, sl, tl, dkey) {
        const options = this._getRequestOptions(text, engine, sl, tl, dkey);
        const response = await this._sendRequest(options);
        return this._parseResponse(response, engine);
    }

    static _getRequestOptions(text, engine, sl, tl, dkey) {
        if (engine === CONFIG.TRANSLATION_ENGINES.GOOGLE) {
            return {
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
                method: "GET"
            };
        } else if (engine === CONFIG.TRANSLATION_ENGINES.DEEPL) {
            return {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `auth_key=${dkey}&text=${encodeURIComponent(text)}&target_lang=${tl}`
            };
        }
        throw new Error(`Unsupported translation engine: ${engine}`);
    }

    static async _sendRequest(options) {
        return new Promise((resolve, reject) => {
            $task.fetch(options).then(
                response => {
                    try {
                        resolve(JSON.parse(response.body));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                },
                error => reject(new Error(`Request failed: ${error}`))
            );
        });
    }

    static _parseResponse(response, engine) {
        if (engine === CONFIG.TRANSLATION_ENGINES.GOOGLE) {
            return response[0]?.[0]?.[0] || "";
        } else if (engine === CONFIG.TRANSLATION_ENGINES.DEEPL) {
            return response.translations?.[0]?.text || "";
        }
        throw new Error(`Unsupported translation engine: ${engine}`);
    }
}

// Main Script Logic
async function main() {
    const url = $request.url;
    const settings = StorageManager.initializeSettings();
    const service = "Tubi";
    
    if (!settings[service]) {
        settings[service] = CONFIG.DEFAULT_SETTINGS[service];
    }
    
    const setting = settings[service];

    if (CONFIG.REGEX.M3U8.test(url)) {
        handleM3U8File(url, settings, service);
    } else if (CONFIG.REGEX.VTT.test(url)) {
        await handleVTTFile(url, setting);
    }
}

function handleM3U8File(url, settings, service) {
    console.log("Processing .m3u8 file...");
    const body = $response.body;
    
    const match = body.match(CONFIG.REGEX.VTT_PATTERN);
    if (match?.[1]) {
        const subtitlesUrl = url.replace(/\/[^\/]+$/, `/${match[1]}`);
        settings[service].t_subtitles_url = subtitlesUrl;
        StorageManager.save("settings", JSON.stringify(settings));
    }

    $done({ body });
}

async function handleVTTFile(url, setting) {
    console.log("Processing .vtt file...");
    
    if (setting.type === CONFIG.TRANSLATION_ENGINES.DISABLE) {
        $done({ body: $response.body });
        return;
    }

    try {
        const vttHandler = new VTTHandler($response.body);
        const { timeline, subtitles } = vttHandler.parse();

        const translated = await TranslationService.translate(
            subtitles,
            setting.type,
            setting.sl,
            setting.tl,
            setting.dkey
        );

        const translatedBody = VTTHandler.rebuild(timeline, subtitles, translated, setting.line);
        $done({ body: translatedBody });
    } catch (error) {
        console.error("Error processing VTT file:", error);
        $done({ body: $response.body });
    }
}

// Start the script
main().catch(error => {
    console.error("Script execution failed:", error);
    $done({});
});
