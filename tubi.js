/*
Tubi Subtitle Translator
Made by 2024
*/

// 请求相关变量
const url = $request.url;
let isRunning = false;
let currentIndex = 0;
let subtitleBlocks = [];
let processedBlocks = [];

// 基础设置
const default_settings = {
    type: "Google",    // 翻译类型
    sl: "auto",        // 源语言
    tl: "zh",         // 目标语言
    line: "s",         // 显示顺序：s-原文在上，t-译文在上
    delay: 1000,       // 请求间隔(毫秒)
    skip_brackets: false,
    translate_sound: true,
    speaker_format: "prefix",
    dkey: "null"
};

// 读取设置
let settings = $persistentStore.read('tubi_settings');
settings = settings ? {...default_settings, ...JSON.parse(settings)} : default_settings;

// 常见音效列表
const SOUND_EFFECTS = new Set([
    "(laughter)", "(laughing)", "(laughs)", 
    "(gasps)", "(gasping)", "(gasp)",
    "(groans)", "(groaning)", "(groan)",
    "(sighs)", "(sighing)", "(sigh)",
    "(chuckles)", "(chuckling)", "(chuckle)",
    "(screams)", "(screaming)", "(scream)",
    "(grunts)", "(grunting)", "(grunt)",
    "(whispers)", "(whispering)", "(whisper)",
    "(coughs)", "(coughing)", "(cough)",
    "(sniffles)", "(sniffling)", "(sniffle)",
    "(sobs)", "(sobbing)", "(sob)",
    "(exhales)", "(exhaling)", "(exhale)",
    "(inhales)", "(inhaling)", "(inhale)",
    "(pants)", "(panting)", "(pant)",
    "(clicks)", "(clicking)", "(click)",
    "(beeps)", "(beeping)", "(beep)",
    "(buzzes)", "(buzzing)", "(buzz)",
    "(hisses)", "(hissing)", "(hiss)",
    "(whirring)", "(whirs)", "(whir)"
]);

// 翻译函数
function translateText(text) {
    return new Promise((resolve) => {
        if (!text?.trim()) {
            resolve('');
            return;
        }

        // 检查是否为音效且不翻译音效
        if (!settings.translate_sound && SOUND_EFFECTS.has(text.toLowerCase().trim())) {
            resolve('');
            return;
        }

        $httpClient.post({
            url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${settings.sl}&tl=${settings.tl}`,
            headers: {
                'User-Agent': 'GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)'
            },
            body: `q=${encodeURIComponent(text.trim())}`
        }, (error, response, data) => {
            try {
                if (error) throw error;
                const result = JSON.parse(data);
                const translated = result.sentences?.map(s => s.trans).join('').trim();
                resolve(translated || '');
            } catch (e) {
                resolve('');
            }
        });
    });
}

// 格式化字幕块
function formatBlock(timing, original, translated) {
    if (!translated) return `${timing}\n${original}`;
    
    if (settings.line === 's') {
        return `${timing}\n${original}\n${translated}`;
    }
    return `${timing}\n${translated}\n${original}`;
}

// 处理单个字幕块
async function processBlock(block) {
    try {
        const lines = block.split('\n');
        const timing = lines.find(line => line.includes(' --> '));
        
        if (!timing) return block;

        const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
        if (!text) return block;

        // 检查是否为音效
        const isSoundEffect = /^\s*[\[\(].*[\]\)]\s*$/.test(text);
        if (isSoundEffect && !settings.translate_sound) {
            return block;
        }

        // 处理极短文本
        if (text.length < 3) {
            return block;
        }

        // 检测说话人标记
        const speakerMatch = text.match(/^([^:：]+)[:：]\s*/);
        let speaker = '';
        let textToTranslate = text;

        if (speakerMatch && settings.speaker_format !== 'disable') {
            speaker = speakerMatch[1];
            textToTranslate = text.substring(speakerMatch[0].length);
        }

        const translated = await translateText(textToTranslate);
        if (!translated) return block;

        if (speaker) {
            return formatBlock(timing, text, `${speaker}: ${translated}`);
        } else {
            return formatBlock(timing, text, translated);
        }
    } catch (e) {
        return block;
    }
}

// 主处理函数
async function processNextBlock() {
    if (currentIndex >= subtitleBlocks.length) {
        // 所有块处理完成
        const result = 'WEBVTT\n\n' + processedBlocks.join('\n\n') + '\n';
        $done({
            body: result,
            headers: {'Content-Type': 'text/vtt;charset=utf-8'}
        });
        isRunning = false;
        return;
    }

    try {
        const block = subtitleBlocks[currentIndex];
        const processed = await processBlock(block);
        processedBlocks.push(processed);
        
        // 休息一会，然后处理下一个
        currentIndex++;
        setTimeout(processNextBlock, settings.delay);
    } catch (e) {
        // 出错时保留原文并继续
        processedBlocks.push(subtitleBlocks[currentIndex]);
        currentIndex++;
        setTimeout(processNextBlock, settings.delay);
    }
}

// 入口函数
function start(body) {
    if (isRunning) return;
    isRunning = true;

    try {
        // 检查类型和内容
        if (settings.type === "Disable" || !body) {
            $done({});
            return;
        }

        // 清理并分割字幕
        body = body.replace(/^WEBVTT\n/, '').trim();
        subtitleBlocks = body.split('\n\n').filter(block => block.trim());
        
        // 开始处理
        processNextBlock();
    } catch (e) {
        console.log('处理错误:', e);
        $done({});
    }
}

// 主函数
if (url.includes('.vtt')) {
    start($response.body);
} else if (url.includes('.m3u8')) {
    $done({});
} else {
    $done({});
