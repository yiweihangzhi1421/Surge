// CombinedSubtitles.response.bundle.js

(async () => {
  try {
    const url = $request.url;
    console.log('处理 URL:', url);
    let modifiedBody = $response.body.string();

    if (/\/.*_hls_master\.m3u8$/.test(url)) {
      // 处理 Manifest.m3u8
      console.log('处理 Manifest.m3u8');
      modifiedBody = handleManifest(modifiedBody);
    } else if (/\/iplayer\/subtitles\/.*\.xml\?.*subtype=(Official|External)/.test(url)) {
      // 处理 Composite Subtitles XML
      console.log('处理 Composite Subtitles XML');
      modifiedBody = handleCompositeSubtitles(modifiedBody);
    } else if (/\/iplayer\/subtitles\/.*\.xml$/.test(url)) {
      // 处理 Translate Subtitles XML
      console.log('处理 Translate Subtitles XML');
      modifiedBody = await handleTranslateSubtitles(modifiedBody);
    } else {
      console.log('未匹配到任何模式，返回原始内容。');
    }

    // 返回修改后的内容
    $done({ body: modifiedBody });

  } catch (error) {
    console.error('脚本错误:', error);
    $done({});
  }
})();

// 处理 Manifest.m3u8 的函数
function handleManifest(originalManifest) {
  // 使用正则表达式查找字幕 URL
  const subtitleRegex = /#EXT-X-MEDIA:.*?URI="(.*?)"/g;
  let match;
  let subtitleURLs = [];

  while ((match = subtitleRegex.exec(originalManifest)) !== null) {
    subtitleURLs.push(match[1]);
  }

  console.log('找到的字幕 URLs:', subtitleURLs);

  // 为每个字幕 URL 生成翻译后的字幕 URL，并添加到 manifest 中
  subtitleURLs.forEach(url => {
    const translatedURL = url.replace('.vtt', '_translated.vtt');
    const newSubtitleEntry = `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="translated",NAME="Chinese",LANGUAGE="ZH",AUTOSELECT=YES,DEFAULT=NO,URI="${translatedURL}"`;
    originalManifest += `\n${newSubtitleEntry}`;
  });

  console.log('修改后的 Manifest:', originalManifest);

  return originalManifest;
}

// 处理 Composite Subtitles XML 的函数
function handleCompositeSubtitles(originalXML) {
  // 解析 XML，提取 <text> 标签中的字幕内容
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(originalXML, "application/xml");
  const subtitles = xmlDoc.getElementsByTagName('text');

  let subtitleTexts = [];
  for (let i = 0; i < subtitles.length; i++) {
    subtitleTexts.push(subtitles[i].textContent.trim());
  }

  console.log('提取的字幕内容:', subtitleTexts);

  // 此处可以添加逻辑，例如标记字幕以便后续翻译
  // 这里暂时返回原始 XML，实际应用中可能需要进一步处理
  return originalXML;
}

// 处理 Translate Subtitles XML 的函数
async function handleTranslateSubtitles(originalXML) {
  // 解析 XML，提取 <text> 标签中的字幕内容
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(originalXML, "application/xml");
  const subtitles = xmlDoc.getElementsByTagName('text');

  let subtitleTexts = [];
  for (let i = 0; i < subtitles.length; i++) {
    subtitleTexts.push(subtitles[i].textContent.trim());
  }

  console.log('提取的字幕内容:', subtitleTexts);

  // 翻译每一行字幕文本
  let translatedTexts = [];
  for (let text of subtitleTexts) {
    if (text === '') {
      translatedTexts.push('');
      continue;
    }

    let translated = await translateText(text, 'ZH'); // 目标语言：中文
    translatedTexts.push(translated);

    // 延时 300 毫秒，避免触发 API 速率限制
    await delay(300);
  }

  console.log('翻译后的字幕内容:', translatedTexts);

  // 将翻译后的文本插入到 XML 中
  for (let i = 0; i < subtitles.length; i++) {
    if (translatedTexts[i]) {
      const translatedNode = xmlDoc.createElement('translatedText');
      translatedNode.textContent = translatedTexts[i];
      subtitles[i].parentNode.insertBefore(translatedNode, subtitles[i].nextSibling);
    }
  }

  // 序列化修改后的 XML
  const serializer = new XMLSerializer();
  const modifiedXML = serializer.serializeToString(xmlDoc);

  console.log('修改后的 Subtitles XML:', modifiedXML);

  return modifiedXML;
}

// 使用 Google Translate API 进行翻译的函数
async function translateText(text, targetLang = 'ZH') {
  const apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY'; // 替换为您的 Google Translate API 密钥
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        format: 'text'
      })
    });

    const result = await response.json();
    if (result.data && result.data.translations.length > 0) {
      return result.data.translations[0].translatedText;
    } else {
      return '';
    }
  } catch (error) {
    console.error('Google Translation Error:', error);
    return '';
  }
}

// 延时函数，避免 API 速率限制
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
