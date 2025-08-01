/**
 * @file Dualsub-Netflix.js
 * @author Gemini
 * @description This script is an enhanced version of the original Dualsub.js, specifically optimized for Netflix.
 * It includes a critical check to ensure that the script only processes subtitle files,
 * preventing it from attempting to modify video data which leads to playback failures.
 * This is necessary because Netflix on some platforms (like iOS) may use muxed streams,
 * where video and subtitles are sent in a single response.
 *
 * This script is a http-response script designed for Surge.
 * It detects the subtitle format (e.g., WebVTT) by checking the response body content.
 * If the body is not a subtitle, it passes the original body through without modification.
 * If it is a subtitle, it proceeds with translation and dual-language formatting.
 */

// Define the translation settings.
// sl: source language, tl: target language
// f: original on top, translated on bottom
// s: translated on top, original on bottom
let setting = {
  type: "Google",
  sl: "auto",
  tl: "zh-CN",
  line: "s"
};

// Main function to process the HTTP response.
(async () => {
  let body = $response.body;
  if (!body) {
    console.log("Empty response body, skipping script.");
    $done({});
    return;
  }

  // A crucial check to determine if the body is a subtitle file.
  // We check for common WebVTT headers.
  if (!body.startsWith("WEBVTT") && !body.includes("NOTE Netflix")) {
    console.log("Response is not a Netflix subtitle file, passing through.");
    // This is the key change. We exit immediately if it's not a subtitle.
    $done({ body });
    return;
  }

  // The rest of the logic is for subtitle processing, which is only executed if the above check passes.
  try {
    console.log("Subtitle file detected. Starting dual-language processing.");

    // Regular expressions for parsing subtitle data.
    const timeRegexp = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;

    function parseTime(time) {
      const match = timeRegexp.exec(time);
      if (!match) return 0;
      const h = parseInt(match[1]), m = parseInt(match[2]), s = parseInt(match[3]), ms = parseInt(match[4]);
      return h * 3600000 + m * 60000 + s * 1000 + ms;
    }

    // Replace line endings and split blocks.
    body = body.replace(/\r/g, "");
    const blocks = body.split(/\n\n+/);

    const subtitles = [];

    for (const block of blocks) {
      const lines = block.trim().split(/\n/);
      // Skip blocks that don't have enough lines to be a valid subtitle.
      if (lines.length < 2) continue;

      // Find the time line in the block.
      const timeLine = lines.find(l => l.includes("-->"));
      if (!timeLine) continue;
      const [start, end] = timeLine.split("-->").map(s => s.trim());

      // Extract the text lines.
      const textLines = lines.slice(lines.indexOf(timeLine) + 1);
      const text = textLines.join("\n").replace(/<[^>]*>?/gm, "").trim();

      // Only push if there is actual text content.
      if (text) {
        subtitles.push({ start, end, text });
      }
    }

    // Extract all original texts to send for translation.
    const texts = subtitles.map(sub => sub.text);
    const query = texts.join("\n");

    /**
     * Translates a given query using the Google Translate API.
     * @param {string} q The text to be translated.
     * @returns {Promise<string>} The translated text.
     */
    async function translate(q) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${setting.sl}&tl=${setting.tl}&q=${encodeURIComponent(q)}`;
      const response = await fetch(url);
      const data = await response.json();
      return data[0].map(item => item[0]).join("");
    }

    const translated = await translate(query);
    const translatedLines = translated.split("\n");

    // Combine original and translated subtitles.
    const combinedSubtitles = subtitles.map((sub, i) => {
      const orig = sub.text;
      const trans = translatedLines[i] || "";
      let combinedText = "";

      if (setting.line === "s") {
        combinedText = `${trans}\n${orig}`;
      } else {
        combinedText = `${orig}\n${trans}`;
      }

      // Add a line break at the end of each block.
      return `${sub.start} --> ${sub.end}\n${combinedText}`;
    }).join("\n\n");

    $done({ body: combinedSubtitles });

  } catch (error) {
    console.log(`Script error: ${error.message}`);
    // If an error occurs, pass the original body through to avoid breaking the player.
    $done({ body });
  }
})();
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    Hulu: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    Netflix: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    Paramount: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    PrimeVideo: {
        type: "Google", // 固定为 Google 翻译
        lang: "English [CC]",
        sl: "auto",
        tl: "zh-CN", // 固定为中文简体
        line: "s", // 固定为中文在上，英文在下
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    General: {
        service: "null",
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    YouTube: {
        type: "Enable", // Enable, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "sl"
    }
}

let settings = $persistentStore.read()

// 如果持久化存储中没有设置，或者用户希望重置，则使用默认设置
if (!settings || (typeof settings === "string" && JSON.parse(settings).PrimeVideo && JSON.parse(settings).PrimeVideo.type === "Reset")) {
    settings = default_settings;
    $persistentStore.write(JSON.stringify(settings)); // 写入默认设置
} else if (typeof settings == "string") {
    settings = JSON.parse(settings);
}

// 强制覆盖 PrimeVideo 的设置，使其固定
settings.PrimeVideo = {
    type: "Google", // 固定为 Google 翻译
    lang: "English [CC]",
    sl: "auto",
    tl: "zh-CN", // 固定为中文简体
    line: "s", // 固定为中文在上，英文在下
    dkey: "null", // DeepL API key
    s_subtitles_url: "null",
    t_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null",
    external_subtitles: "null"
};
// 写入更新后的设置，确保 PrimeVideo 的设置被固定
$persistentStore.write(JSON.stringify(settings));


let service = ""
if (url.match(/(dss|star)ott.com/)) service = "Disney"
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax"
if (url.match(/huluim.com/)) service = "Hulu"
if (url.match(/nflxvideo.net/)) service = "Netflix"
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount"
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo"
if (url.match(/general.media/)) service = "General"
if (url.match(/youtube.com/)) service = "YouTube"

if (settings.General) {
    let general_service = settings.General.service.split(", ")
    for (var s in general_service) {
        let patt = new RegExp(general_service[s])
        if (url.match(patt)) {
            service = "General"
            break
        }
    }
}

if (!service) $done({})

// 获取当前服务的设置，由于 PrimeVideo 已被固定，这里获取到的就是固定后的设置
let setting = settings[service]

// 如果当前服务是 PrimeVideo 且是设置请求，则直接结束，不再处理动态设置
if (service === "PrimeVideo" && url.match(/action=(g|s)et/)) {
    $done({});
}

if (setting.type == "Disable") $done({})

if (setting.type != "Official" && url.match(/\.m3u8/)) $done({})

if (!body) $done({})


// 核心字幕处理逻辑的入口点
if (url.match(/\.(web)?vtt/) || service == "General" || (service == "Netflix" && isNetflixSubtitleUrl(url))) {
    if (service != "Netflix" && url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) $done({ body: setting.subtitles })

    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") $done({})
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")

    if (setting.type == "DeepL") machine_subtitles("DeepL")

    if (setting.type == "External") external_subtitles()
} else if (service === "Netflix") {
    // 如果是 Netflix 请求，但不是字幕 URL，则直接放行，不进行处理
    $done({});
}


function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`)
    if (!setting.external_subtitles.match(patt)) $done({})
    if (!body.match(patt)) $done({})
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
    body = body.replace(patt, external.match(patt)[0])
    $done({ body })
}

async function machine_subtitles(type) {

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)

    if (!dialogue) $done({})

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    let s_sentences = []
    for (var i in dialogue) {
        s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
    }
    s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50)

    let t_sentences = []
    let trans_result = []

    if (type == "Google") {
        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                headers: {
                    "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
                },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            }

            let trans = await send_request(options, "post")

            if (trans.sentences) {
                let sentences = trans.sentences
                for (var k in sentences) {
                    if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
                }
            }
        }

        if (trans_result.length > 0) {
            t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
        }

    }

    if (type == "DeepL") {
        for (var l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            }

            let trans = await send_request(options, "post")

            if (trans.translations) trans_result.push(trans.translations)
        }

        if (trans_result.length > 0) {
            for (var o in trans_result) {
                for (var u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "))
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")

        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`)
            if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)

            let patt2 = new RegExp(`~${j}~\\s*(.+)`)

            if (g_t_sentences.match(patt2) && type == "Google") body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)

            if (type == "DeepL") body = body.replace(patt, `$1\n${t_sentences[j]}`)

        }

        if (service != "Netflix") {
            settings[service].s_subtitles_url = url
            settings[service].subtitles = body
            settings[service].subtitles_type = setting.type
            settings[service].subtitles_sl = setting.sl
            settings[service].subtitles_tl = setting.tl
            settings[service].subtitles_line = setting.line
            $persistentStore.write(JSON.stringify(settings))
        }
    }

    $done({ body })

}

async function official_subtitles(subtitles_urls_data) {
    let result = []

    if (service == "Disney" || service == "HBOMax") {
        let subtitles_index = parseInt(url.match(/(\d+)\.vtt/)[1])

        let start = subtitles_index - 3 < 0 ? 0 : subtitles_index - 3

        subtitles_urls_data = subtitles_urls_data.slice(start, subtitles_index + 4)
    }

    for (var k in subtitles_urls_data) {
        let options = {
            url: subtitles_urls_data[k],
            headers: headers
        }
        result.push(await send_request(options, "get"))
    }

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    for (var i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]})`)
        if (setting.line == "s") patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`)

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0]

        let patt2 = new RegExp(`${time}.\\d\\d\\d --> \\d+:\\d\d:\\d\d.\\d.+(\\n.+)+`)

        let dialogue = result.join("\n\n").match(patt2)

        if (dialogue) body = body.replace(
            patt1,
            `$1\n${dialogue[0]
                .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")
                .replace(/\n/, " ")}`
        )
    }

    settings[service].s_subtitles_url = url
    settings[service].subtitles = body
    settings[service].subtitles_type = setting.type
    settings[service].subtitles_sl = setting.sl
    settings[service].subtitles_tl = setting.tl
    settings[service].subtitles_line = setting.line
    $persistentStore.write(JSON.stringify(settings))

    $done({ body })
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {

        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject('Error')
                resolve(data)
            })
        }

        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject('Error')
                resolve(JSON.parse(data))
            })
        }
    })
}

function groupAgain(data, num) {
    var result = []
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num))
    }
    return result
}
    Hulu: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    Netflix: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    Paramount: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    PrimeVideo: {
        type: "Google", // 固定为 Google 翻译
        lang: "English [CC]",
        sl: "auto",
        tl: "zh-CN", // 固定为中文简体
        line: "s", // 固定为中文在上，英文在下
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    General: {
        service: "null",
        type: "Google", // Google, DeepL, External, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    },
    YouTube: {
        type: "Enable", // Enable, Disable
        lang: "English",
        sl: "auto",
        tl: "en",
        line: "sl"
    }
}

let settings = $persistentStore.read()

// 如果持久化存储中没有设置，或者用户希望重置，则使用默认设置
if (!settings || (typeof settings === "string" && JSON.parse(settings).PrimeVideo && JSON.parse(settings).PrimeVideo.type === "Reset")) {
    settings = default_settings;
    $persistentStore.write(JSON.stringify(settings)); // 写入默认设置
} else if (typeof settings == "string") {
    settings = JSON.parse(settings);
}

// 强制覆盖 PrimeVideo 的设置，使其固定
settings.PrimeVideo = {
    type: "Google", // 固定为 Google 翻译
    lang: "English [CC]",
    sl: "auto",
    tl: "zh-CN", // 固定为中文简体
    line: "s", // 固定为中文在上，英文在下
    dkey: "null", // DeepL API key
    s_subtitles_url: "null",
    t_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null",
    external_subtitles: "null"
};
// 写入更新后的设置，确保 PrimeVideo 的设置被固定
$persistentStore.write(JSON.stringify(settings));


let service = ""
if (url.match(/(dss|star)ott.com/)) service = "Disney"
if (url.match(/hbo(maxcdn)*.com/)) service = "HBOMax"
if (url.match(/huluim.com/)) service = "Hulu"
if (url.match(/nflxvideo.net/)) service = "Netflix"
if (url.match(/cbs(aa|i)video.com/)) service = "Paramount"
if (url.match(/(cloudfront|akamaihd|avi-cdn).net/)) service = "PrimeVideo"
if (url.match(/general.media/)) service = "General"
if (url.match(/youtube.com/)) service = "YouTube"

if (settings.General) {
    let general_service = settings.General.service.split(", ")
    for (var s in general_service) {
        let patt = new RegExp(general_service[s])
        if (url.match(patt)) {
            service = "General"
            break
        }
    }
}

if (!service) $done({})

// 获取当前服务的设置，由于 PrimeVideo 已被固定，这里获取到的就是固定后的设置
let setting = settings[service]

// 如果当前服务是 PrimeVideo 且是设置请求，则直接结束，不再处理动态设置
if (service === "PrimeVideo" && url.match(/action=(g|s)et/)) {
    $done({});
}

if (setting.type == "Disable") $done({})

if (setting.type != "Official" && url.match(/\.m3u8/)) $done({})

let body = $response.body

if (!body) $done({})

// --- 新增的 Netflix 字幕 URL 内部判断函数 ---
function isNetflixSubtitleUrl(currentUrl) {
    // 检查常见的 Netflix 字幕路径模式
    const pathRegex = /\/(timedtext|track)\/.+\.(vtt|dfxp|xml|srt|ttml|webvtt|json)/;
    // 检查常见的 Netflix 字幕查询参数模式
    const queryParamFRegex = /\?.*&f=.*(vtt|dfxp|xml|srt|ttml|webvtt|json)/;
    const queryParamTRegex = /\?.*&t=subtitles/;

    return pathRegex.test(currentUrl) || queryParamFRegex.test(currentUrl) || queryParamTRegex.test(currentUrl);
}
// --- 新增的 Netflix 字幕 URL 内部判断函数结束 ---


// 核心字幕处理逻辑的入口点
// 针对 Netflix，增加 isNetflixSubtitleUrl 检查
if (url.match(/\.(web)?vtt/) || service == "General" || (service == "Netflix" && isNetflixSubtitleUrl(url))) {
    if (service != "Netflix" && url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) $done({ body: setting.subtitles })

    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") $done({})
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")

    if (setting.type == "DeepL") machine_subtitles("DeepL")

    if (setting.type == "External") external_subtitles()
} else if (service === "Netflix") {
    // 如果是 Netflix 请求，但不是字幕 URL，则直接放行，不进行处理
    $done({});
}


function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`)
    if (!setting.external_subtitles.match(patt)) $done({})
    if (!body.match(patt)) $done({})
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
    body = body.replace(patt, external.match(patt)[0])
    $done({ body })
}

async function machine_subtitles(type) {

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)

    if (!dialogue) $done({})

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    let s_sentences = []
    for (var i in dialogue) {
        s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
    }
    s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50)

    let t_sentences = []
    let trans_result = []

    if (type == "Google") {
        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                headers: {
                    "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
                },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            }

            let trans = await send_request(options, "post")

            if (trans.sentences) {
                let sentences = trans.sentences
                for (var k in sentences) {
                    if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
                }
            }
        }

        if (trans_result.length > 0) {
            t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
        }

    }

    if (type == "DeepL") {
        for (var l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            }

            let trans = await send_request(options, "post")

            if (trans.translations) trans_result.push(trans.translations)
        }

        if (trans_result.length > 0) {
            for (var o in trans_result) {
                for (var u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "))
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")

        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`)
            if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)

            let patt2 = new RegExp(`~${j}~\\s*(.+)`)

            if (g_t_sentences.match(patt2) && type == "Google") body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)

            if (type == "DeepL") body = body.replace(patt, `$1\n${t_sentences[j]}`)

        }

        if (service != "Netflix") {
            settings[service].s_subtitles_url = url
            settings[service].subtitles = body
            settings[service].subtitles_type = setting.type
            settings[service].subtitles_sl = setting.sl
            settings[service].subtitles_tl = setting.tl
            settings[service].subtitles_line = setting.line
            $persistentStore.write(JSON.stringify(settings))
        }
    }

    $done({ body })

}

async function official_subtitles(subtitles_urls_data) {
    let result = []

    if (service == "Disney" || service == "HBOMax") {
        let subtitles_index = parseInt(url.match(/(\d+)\.vtt/)[1])

        let start = subtitles_index - 3 < 0 ? 0 : subtitles_index - 3

        subtitles_urls_data = subtitles_urls_data.slice(start, subtitles_index + 4)
    }

    for (var k in subtitles_urls_data) {
        let options = {
            url: subtitles_urls_data[k],
            headers: headers
        }
        result.push(await send_request(options, "get"))
    }

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    for (var i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]})`)
        if (setting.line == "s") patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`)

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0]

        let patt2 = new RegExp(`${time}.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n.+)+`)

        let dialogue = result.join("\n\n").match(patt2)

        if (dialogue) body = body.replace(
            patt1,
            `$1\n${dialogue[0]
                .replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")
                .replace(/\n/, " ")}`
        )
    }

    settings[service].s_subtitles_url = url
    settings[service].subtitles = body
    settings[service].subtitles_type = setting.type
    settings[service].subtitles_sl = setting.sl
    settings[service].subtitles_tl = setting.tl
    settings[service].subtitles_line = setting.line
    $persistentStore.write(JSON.stringify(settings))

    $done({ body })
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {

        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject('Error')
                resolve(data)
            })
        }

        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject('Error')
                resolve(JSON.parse(data))
            })
        }
    })
}

function groupAgain(data, num) {
    var result = []
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num))
    }
    return result
}
