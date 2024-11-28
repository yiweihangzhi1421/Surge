/*
Tubi Subtitle Translator
Made by 2024
*/

const url = $request.url;

// 基础设置
const default_settings = {
    type: "Google",  
    sl: "auto",       
    tl: "zh",         
    line: "s",       
    delay: 1000      
};

// 读取设置
let settings = $persistentStore.read('tubi_settings');
settings = settings ? {...default_settings, ...JSON.parse(settings)} : default_settings;

// 基础变量
let isRunning = false;
let currentIndex = 0;
let subtitleBlocks = [];
let processedBlocks = [];

// 音效和短语检测
const SOUND_EFFECTS = new Set([
    "(laughter)", "(laughing)", "(laughs)", 
    "(gasps)", "(gasping)", "(gasp)",
    "(grunts)", "(grunting)", "(grunt)",
    "(sighs)", "(sighing)", "(sigh)"
]);

// 翻译函数
function translateText(text) {
    return new Promise((resolve) => {
        if (!text?.trim() || text.length < 3) {
            resolve('');
            return;
        }

        // 检查是否为音效
        if (SOUND_EFFECTS.has(text.toLowerCase().trim())) {
            resolve(text);
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
                console.log('翻译错误:', e);
                resolve('');
            }
        });
    });
}

// 格式化字幕块
function formatBlock(timing, original, translated) {
    if (!translated) return `${timing}\n${original}`;
    
    return settings.line === 's' 
        ? `${timing}\n${original}\n${translated}`
        : `${timing}\n${translated}\n${original}`;
}

// 处理单个字幕块
async function processBlock(block) {
    try {
        const lines = block.split('\n');
        const timing = lines.find(line => line.includes(' --> '));
        
        if (!timing) return block;

        const text = lines.slice(lines.indexOf(timing) + 1).join(' ').trim();
        if (!text) return block;

        // 预处理和检查
        if (text.length < 3) return block;

        // 提取说话人信息
        const speakerMatch = text.match(/^([^:：]+)[:：]\s*/);
        let speaker = '';
        let textToTranslate = text;

        if (speakerMatch) {
            speaker = speakerMatch[1];
            textToTranslate = text.substring(speakerMatch[0].length);
        }

        // 翻译处理
        const translated = await translateText(textToTranslate);
        if (!translated) return block;

        // 重新组合字幕
        return formatBlock(
            timing,
            text,
            speaker ? `${speaker}: ${translated}` : translated
        );
    } catch (e) {
        console.log('处理错误:', e);
        return block;
    }
}

// 主处理函数
async function processNextBlock() {
    if (currentIndex >= subtitleBlocks.length) {
        // 完成所有处理
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
        
        currentIndex++;
        setTimeout(processNextBlock, settings.delay);
    } catch (e) {
        console.log('处理错误:', e);
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
        // 预处理字幕
        body = body.replace(/^WEBVTT\n/, '').trim();
        subtitleBlocks = body.split('\n\n').filter(block => block.trim());
        
        // 开始处理
        processNextBlock();
    } catch (e) {
        console.log('启动错误:', e);
        $done({});
    }
}

// 主入口
if (url.includes('.vtt')) {
    if ($response.body) {
        start($response.body);
    } else {
        $done({});
    }
} else if (url.includes('.m3u8')) {
    $done({});
} else {
    $done({});
}
