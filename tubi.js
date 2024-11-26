// 基础配置
const CONFIG = {
    DEFAULT_SETTINGS: {
        Tubi: {
            type: "Google",    
            lang: "zh-CN",     
            sl: "auto",        
            tl: "zh-CN",       
            line: "s",         
            dkey: "",          
            timeout: 1500      // 1.5秒超时
        }
    },
    REGEX: {
        M3U8: /\.m3u8/,
        VTT: /\.vtt/,
        TIMELINE: /^\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}\.\d{3}/,
        VTT_PATTERN: /#EXTINF:.+\n([^\n]+\.vtt)/,
        MUSIC: /^\([^)]+\)$/,
        SPECIAL: /^♪.*♪$/
    }
};

// VTT处理类
class VTTHandler {
    static async process(body, setting) {
        try {
            // 处理二进制数据
            const text = body instanceof Uint8Array ? 
                new TextDecoder('utf-8').decode(body) : body;

            // 快速分割处理
            const lines = text.split('\n');
            const processedLines = [];
            let isHeader = true;
            let currentTimeline = null;
            let currentText = [];
            let batchPromises = [];

            // 处理每一行
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // 处理头部
                if (isHeader) {
                    if (line === 'WEBVTT') {
                        processedLines.push('WEBVTT', '');
                        isHeader = false;
                    }
                    continue;
                }

                // 检查时间轴
                if (CONFIG.REGEX.TIMELINE.test(line)) {
                    // 处理前一个字幕块
                    if (currentTimeline && currentText.length > 0) {
                        batchPromises.push(this._processSubtitleBlock(
                            currentTimeline, 
                            currentText,
                            setting
                        ));
                    }

                    // 开始新的字幕块
                    currentTimeline = line;
                    currentText = [];
                    continue;
                }

                // 收集文本内容
                if (line && currentTimeline) {
                    currentText.push(line);
                }

                // 处理批次翻译
                if (batchPromises.length >= 5 || i === lines.length - 1) {
                    const results = await Promise.all(batchPromises);
                    processedLines.push(...results.flat());
                    batchPromises = [];
                }
            }

            // 处理最后一个字幕块
            if (currentTimeline && currentText.length > 0) {
                batchPromises.push(this._processSubtitleBlock(
                    currentTimeline, 
                    currentText,
                    setting
                ));
            }

            // 处理剩余的翻译请求
            if (batchPromises.length > 0) {
                const results = await Promise.all(batchPromises);
                processedLines.push(...results.flat());
            }

            return processedLines.join('\n');
        } catch (error) {
            console.error('VTT处理失败:', error);
            return body;
        }
    }

    static async _processSubtitleBlock(timeline, textLines, setting) {
        const result = [timeline];

        for (const line of textLines) {
            // 跳过空行
            if (!line) continue;

            // 保持音乐标记和特殊行不变
            if (CONFIG.REGEX.MUSIC.test(line) || 
                CONFIG.REGEX.SPECIAL.test(line)) {
                result.push(line);
                continue;
            }

            // 添加原文
            if (setting.line === 's') {
                result.push(line);
            }

            // 翻译文本
            try {
                const translation = await this._translateText(line);
                if (translation && translation !== line) {
                    result.push(translation);
                }
            } catch (error) {
                console.error('翻译失败:', error);
            }

            // 如果翻译在上，添加原文
            if (setting.line !== 's') {
                result.push(line);
            }
        }

        result.push(''); // 添加空行分隔
        return result;
    }

    static async _translateText(text) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(
                () => reject(new Error('翻译超时')), 
                CONFIG.DEFAULT_SETTINGS.Tubi.timeout
            );

            $task.fetch({
                url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
                method: "GET",
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }).then(
                response => {
                    clearTimeout(timeoutId);
                    try {
                        const result = JSON.parse(response.body);
                        resolve(result[0]?.[0]?.[0] || '');
                    } catch {
                        reject(new Error('解析失败'));
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

// 文件处理函数
async function handleVTTFile(setting) {
    try {
        if (setting.type === "Disable") {
            $done({});
            return;
        }

        const result = await VTTHandler.process($response.body, setting);
        
        // 保持原有的 headers
        $done({ 
            body: result,
            headers: $response.headers
        });
    } catch (error) {
        console.error("VTT处理失败:", error);
        $done({
            body: $response.body,
            headers: $response.headers
        });
    }
}

async function handleM3U8File(url, settings, service) {
    try {
        const body = $response.body;
        const match = body.match(CONFIG.REGEX.VTT_PATTERN);
        
        if (match?.[1]) {
            const subtitlesUrl = url.replace(/\/[^\/]+$/, `/${match[1]}`);
            settings[service].t_subtitles_url = subtitlesUrl;
            $persistentStore.write(JSON.stringify(settings), "settings");
        }

        $done({ body });
    } catch (error) {
        console.error("M3U8处理失败:", error);
        $done({ body: $response.body });
    }
}

// 主函数
async function main() {
    try {
        const url = $request.url;
        let settings = {};
        
        try {
            settings = JSON.parse($persistentStore.read("settings") || "{}");
        } catch {
            settings = CONFIG.DEFAULT_SETTINGS;
        }

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
