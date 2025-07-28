/*
Netflix Dualsub for Surge by Neurogram (MODIFIED)
- Platform: Netflix
- Translation: Google
- Format: Chinese (Simplified) on top, English below
- No Shortcuts, all settings hardcoded
*/

let url = $request.url;
let headers = $request.headers;

let default_settings = {
  Netflix: {
    type: "Google",          // Use Google Translate
    lang: "English",         // Original subtitle language
    sl: "auto",              // Auto detect source language
    tl: "zh-CN",             // Target language: Simplified Chinese
    line: "f",               // f: Chinese on top, English below
    dkey: "null",
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
    type: "Google",
    lang: "English",
    sl: "auto",
    tl: "en",
    line: "s",
    dkey: "null",
    s_subtitles_url: "null",
    t_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null",
    external_subtitles: "null"
  }
};

let settings = $persistentStore.read();
if (!settings) settings = default_settings;
if (typeof settings === "string") settings = JSON.parse(settings);

let service = "";
if (url.match(/nflxvideo.net/)) service = "Netflix";
if (!service) $done({});

if (!settings[service]) settings[service] = default_settings[service];
let setting = settings[service];

if (url.match(/action=get/)) {
  delete setting.t_subtitles_url;
  delete setting.subtitles;
  delete setting.external_subtitles;
  $done({ response: { body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } } });
}

if (url.match(/action=set/)) {
  let new_setting = JSON.parse($request.body);
  if (new_setting.type != "External") settings[service].external_subtitles = "null";
  if (new_setting.type == "Reset") new_setting = default_settings[service];
  if (new_setting.service && service == "General") settings[service].service = new_setting.service.replace(/\r/g, "");
  if (new_setting.type) settings[service].type = new_setting.type;
  if (new_setting.lang) settings[service].lang = new_setting.lang;
  if (new_setting.sl) settings[service].sl = new_setting.sl;
  if (new_setting.tl) settings[service].tl = new_setting.tl;
  if (new_setting.line) settings[service].line = new_setting.line;
  if (new_setting.dkey && service != "YouTube") settings[service].dkey = new_setting.dkey;
  if (new_setting.s_subtitles_url) settings[service].s_subtitles_url = new_setting.s_subtitles_url;
  if (new_setting.t_subtitles_url) settings[service].t_subtitles_url = new_setting.t_subtitles_url;
  if (new_setting.subtitles) settings[service].subtitles = new_setting.subtitles;
  if (new_setting.subtitles_type) settings[service].subtitles_type = new_setting.subtitles_type;
  if (new_setting.subtitles_sl) settings[service].subtitles_sl = new_setting.subtitles_sl;
  if (new_setting.subtitles_tl) settings[service].subtitles_tl = new_setting.subtitles_tl;
  if (new_setting.subtitles_line) settings[service].subtitles_line = new_setting.subtitles_line;
  if (new_setting.external_subtitles) settings[service].external_subtitles = new_setting.external_subtitles.replace(/\r/g, "");
  $persistentStore.write(JSON.stringify(settings));
  delete settings[service].t_subtitles_url;
  delete settings[service].subtitles;
  delete settings[service].external_subtitles;
  $done({ response: { body: JSON.stringify(settings[service]), headers: { "Content-Type": "application/json" } } });
}

if (setting.type == "Disable") $done({});
if (setting.type != "Official" && url.match(/\.m3u8/)) $done({});
let body = $response.body;
if (!body) $done({});

if (setting.type == "Google") {
  body = body.replace(/\r/g, "").replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d+\n.+)\n(.+)/g, "$1 $2");
  let dialogue = body.match(/\d+:\d\d:\d\d.\d+ --> \d+:\d\d:\d\d.\d+\n.+/g);
  if (!dialogue) $done({});
  let timeline = body.match(/\d+:\d\d:\d\d.\d+ --> \d+:\d\d:\d\d.\d+/g);

  let s_sentences = dialogue.map((line, i) => `~${i}~` + line.replace(/<[^>]+>/g, "").replace(/^.*\n/, ""));
  s_sentences = groupAgain(s_sentences, 80);

  let trans_result = [];
  (async () => {
    for (let group of s_sentences) {
      let res = await send_request({
        url: `https://translate.google.com/translate_a/single?client=it&dt=t&dj=1&sl=${setting.sl}&tl=${setting.tl}&ie=UTF-8&oe=UTF-8`,
        headers: { "User-Agent": "GoogleTranslate/6.29 (iOS)" },
        body: `q=${encodeURIComponent(group.join("\n"))}`
      }, "post");
      if (res.sentences) {
        for (let s of res.sentences) {
          if (s.trans) trans_result.push(s.trans.replace(/〜|～/g, "~"));
        }
      }
    }
    let t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g);
    if (!t_sentences) $done({ body });

    for (let j in dialogue) {
      let patt = new RegExp("(" + timeline[j].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")");
      let patt2 = new RegExp("~" + j + "~\\s*(.+)");
      let t_line = t_sentences.find(l => l.match(patt2));
      if (t_line) {
        let translated = t_line.match(patt2)[1];
        if (setting.line == "f") {
          body = body.replace(patt, `$1\n${translated}`);
        } else {
          body = body.replace(patt, `$1\n${translated}`);
        }
      }
    }
    $done({ body });
  })();
} else {
  $done({ body });
}

function send_request(options, method) {
  return new Promise((resolve, reject) => {
    if (method === "get") {
      $httpClient.get(options, (err, res, data) => err ? reject(err) : resolve(data));
    } else {
      $httpClient.post(options, (err, res, data) => err ? reject(err) : resolve(JSON.parse(data)));
    }
  });
}

function groupAgain(data, num) {
  let result = [];
  for (let i = 0; i < data.length; i += num) {
    result.push(data.slice(i, i + num));
  }
  return result;
}
