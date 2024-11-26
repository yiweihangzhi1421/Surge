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
            timeout: 1500      // 降低超时阈值
        }
    },
    REGEX: {
        M3U8: /\.m3u8/,
        VTT: /\.vtt/,
        TIMELINE: /\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}\.\d{3}/,
        VTT_PATTERN: /#EXTINF:.+\n([^\n]+\.vtt)/,
        MUSIC: /^\([^)]+\)$/
    }
};

// 快速字符串处理类
class StringProcessor {
    static decodeBody(body) {
        if (body instanceof Uint8Array) {
            try {
                return new TextDecoder('utf-8').decode(body);
            } catch (e) {
                console.error('UTF-8解码失败，尝试其他编码:', e);
                try {
                    // 尝试其他编码
                    return new TextDecoder('iso-8859-1').decode(body);
                } catch {
                    // 最后的后备方案
                    return String.fromCharCode.apply(null, body);
                }
            }
        }
        return body;
    }

    static cleanText(text) {
        return text?.trim()?.replace(/\s+/g, ' ') || '';
    }
}

// VTT处理类
class VTTProcessor {
    static async process(body, setting) {
        try {
            // 解码文本
            const content = StringProcessor.decodeBody(body);
            if (!content) return body;

            // 快速分块处理
            const blocks = content.split('\n\n');
            const header = blocks[0];
            if (header !== 'WEBVTT') return body;

            let result = 'WEBVTT\n\n';
            let translatePromises = [];

            // 处理每个字幕块
            for (let i = 1; i < blocks.length; i++) {
                const block = blocks[i].trim();
                if (!block) continue;

                const lines = block.split('\n');
                const timeline = lines.find(line => CONFIG.REGEX.TIMELINE.test(line));
                if (!timeline) continue;

                const text = lines.find(line => 
                    line !== timeline && line.trim() && !CONFIG.REGEX.MUSIC.test(line)
                );

                if (!text) {
                    // 如果只有时间轴或是音乐标记，直接添加原文
                    result += block + '\n\n';
                    continue;
                }

                // 收集翻译任务
                translatePromises.push(
                    translateBlock(timeline, text)
                        .catch(err => {
                            console.error('翻译失败:', err);
                            return { timeline, text, translation: '' };
                        })
                );

                // 每10个任务或最后一块时进行处理
                if (translatePromises.length >= 10 || i === blocks.length - 1) {
                    const translations = await Promise.all(translatePromises);
                    for (const { timeline, text, translation } of translations) {
                        if (setting.line === 's') {
                            result += `${timeline}\n${text}\n${translation}\n\n`;
                        } else {
                            result += `${timeline}\n${translation}\n${text}\n\n`;
                        }
                    }
                    translatePromises = [];
                }
            }

            return result;
        } catch (error) {
            console.error('VTT处理失败:', error);
            return body;
        }
    }
}

// 翻译模块
async function translateBlock(timeline, text) {
    try {
        const cleanText = StringProcessor.cleanText(text);
        if (!cleanText) return { timeline, text, translation: '' };

        const translation = await translateText(cleanText);
        return { timeline, text, translation };
    } catch {
        return { timeline, text, translation: '' };
    }
}

// 翻译函数
async function translateText(text) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('翻译超时')), CONFIG.DEFAULT_SETTINGS.Tubi.timeout);

        $task.fetch({
            url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
            method: "GET",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36'
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

// 处理VTT文件
async function handleVTTFile(setting) {
    try {
        if (setting.type === "Disable") {
            $done({});
            return;
        }

        const result = await VTTProcessor.process($response.body, setting);

        $done({ 
            body: result,
            headers: {
                ...$response.headers,
                'Content-Type': 'text/vtt;charset=utf-8'
            }
        });
    } catch (error) {
        console.error("处理失败:", error);
        $done({
            body: $response.body,
            headers: $response.headers
        });
    }
}

// 处理M3U8文件
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
        const settings = JSON.parse($persistentStore.read("settings") || 
            JSON.stringify(CONFIG.DEFAULT_SETTINGS));
        const service = "Tubi";
        
        if (CONFIG.REGEX.M3U8.test(url)) {
            await handleM3U8File(url, settings, service);
        } else if (CONFIG.REGEX.VTT.test(url)) {
            await handleVTTFile(settings[service] || CONFIG.DEFAULT_SETTINGS[service]);
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
