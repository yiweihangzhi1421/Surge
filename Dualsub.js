/*
    Dualsub for Surge by Neurogram (简化版，固定中英文双语字幕)
 
        - 支持 Disney+, Star+, HBO Max, Prime Video, YouTube, Hulu, Netflix, Paramount+ 等多平台中英文双语字幕
        - 支持 Google 和 DeepL 机器翻译双语字幕
        - 固定为中英文字幕，不通过快捷方式设置

        Surge:

        [Script]

        // all in one
        Dualsub = type=http-response,pattern=^http.+(media.(dss|star)ott|manifests.v2.api.hbo|hbomaxcdn|nflxvideo|cbs(aa|i)video|cloudfront|akamaihd|avi-cdn|huluim|youtube).(com|net)\/(.+\.vtt($|\?m=\d+)|.+-all-.+\.m3u8.*|hls\.m3u8.+|\?o=\d+&v=\d+&e=.+|\w+\/2\$.+\/[a-zA-Z0-9-]+\.m3u8|api\/timedtext.+),requires-body=1,max-size=0,timeout=30,script-path=Dualsub.js

        [MITM]
        hostname = *.media.dssott.com, *.media.starott.com, *.api.hbo.com, *.hbomaxcdn.com, *.huluim.com, *.nflxvideo.net, *.cbsaavideo.com, *.cbsivideo.com, *.cloudfront.net, *.akamaihd.net, *.avi-cdn.net, *.youtube.com
    作者:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url
let headers = $request.headers

// 固定为中英文双语字幕设置
let default_settings = {
    Disney: {
        type: "Google", // 启用 Google 机器翻译
        lang: "English + Chinese", // 固定为中英文双语
        sl: "auto", // 源语言自动检测
        tl: "zh", // 目标语言设置为中文
        line: "f" // 单行字幕
    },
    HBOMax: {
        type: "Google",
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "f"
    },
    Hulu: {
        type: "Google",
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "f"
    },
    Netflix: {
        type: "Google",
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "f"
    },
    Paramount: {
        type: "Google",
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "f"
    },
    PrimeVideo: {
        type: "Google",
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "f"
    },
    YouTube: {
        type: "Enable", // 启用双语字幕
        lang: "English + Chinese",
        sl: "auto",
        tl: "zh",
        line: "f"
    }
}

// 使用默认设置，不再从持久化存储读取
let settings = default_settings

// 确定当前服务
let service = ""
if (url.match(/(dss|star)ott.com/)) service = "Disney"
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax"
if (url.match(/huluim.com/)) service = "Hulu"
if (url.match(/nflxvideo.net/)) service = "Netflix"
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount"
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo"
if (url.match(/youtube.com/)) service = "YouTube"

if (!service) $done({})

let setting = settings[service]

if (setting.type == "Disable") $done({})

let body = $response.body

if (!body) $done({})

// 调试输出：检查字幕文件是否正确加载
console.log("正在处理的字幕文件 URL: ", url);

// 处理 YouTube 双语字幕
if (service == "YouTube") {
    let patt = new RegExp(`lang=${setting.tl}`)
    if (url.match(patt) || url.match(/&tlang=/)) $done({})
    let t_url = `${url}&tlang=${setting.tl}`
    let options = { url: t_url, headers: headers }

    $httpClient.get(options, function (error, response, data) {
        console.log("YouTube 字幕翻译请求成功，开始处理...");
        if (setting.line == "s") $done({ body: data })
        let timeline = body.match(/<p t="\d+" d="\d+">/g)

        if (url.match(/&kind=asr/)) {
            body = body.replace(/<\/?s[^>]*>/g, "")
            data = data.replace(/<\/?s[^>]*>/g, "")
            timeline = body.match(/<p t="\d+" d="\d+"[^>]+>/g)
        }

        for (var i in timeline) {
            let patt = new RegExp(`${timeline[i]}([^<]+)<\\/p>`)
            if (body.match(patt) && data.match(patt)) {
                if (setting.line == "s") body = body.replace(patt, `${timeline[i]}$1\n${data.match(patt)[1]}</p>`)
            }
        }

        $done({ body })
    })
}

// 其他平台的处理逻辑
if (setting.type == "Google" && url.match(/\.(web)?vtt/)) {
    machine_subtitles("Google")
}

async function machine_subtitles(type) {
    console.log("开始翻译字幕...");
    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)
    if (!dialogue) $done({})

    let s_sentences = dialogue.map(d => `&text=${d.replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
    let t_sentences = []
    let trans_result = []

    for (var p in s_sentences) {
        let options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&hl=en&sl=${setting.sl}&tl=${setting.tl}`,
            headers: { "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)" },
            body: `q=${encodeURIComponent(s_sentences[p])}`
        }

        let trans = await send_request(options, "post")
        console.log("Google 翻译返回：", trans);  // 打印翻译结果
        if (trans.sentences) {
            let sentences = trans.sentences
            for (var k in sentences) {
                if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " "))
            }
        }
    }

    if (trans_result.length > 0) {
        t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")
        for (var j in dialogue) {
            let patt = new RegExp(`(${dialogue[j]})`)
            let patt2 = new RegExp(`~${j}~\\s*(.+)`)
            if (g_t_sentences.match(patt2)) body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)
        }
    }

    console.log("最终字幕内容: ", body);  // 打印最终字幕内容
    $done({ body })
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {
        $httpClient[method](options, function (error, response, data) {
            if (error) return reject('Error')
            resolve(method == "get" ? data : JSON.parse(data))
        })
    })
}
