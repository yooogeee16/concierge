// 無料枠でも安定して使えることを確認済みのモデル。設定でmodelを指定すれば上書きできる。
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

function buildPrompt(term, contextLine, tone) {
  return `あなたは、画面上でユーザーがカーソルを合わせた語句を説明するアシスタントです。
以下の「対象語句」について、100〜150文字程度の日本語で、正確さを最優先にわかりやすく説明してください。

制約:
- 確実に分かっている事実のみを述べ、推測や不確かな情報は書かない。
- 語句の意味が複数考えられる場合は、周辺の文脈から最も妥当な1つを選んで説明する。
- 対象語句が固有名詞・専門用語・略語などで確信が持てない場合は、断定を避けるか「情報が不十分で断定できません」と正直に答える。
- 対象語句はOCR(文字認識)で読み取ったものなので、誤字や余計な記号(罫線・箇条書き記号などの写り込み)が混じっている場合がある。周辺の文脈から、実際に指しているであろう正しい語句を判断すること。
- 話し方(口調)は次の指定に従う。ただし、この指定は言い回しのみに適用し、事実の正確さより優先しない: ${tone}
- 出力は必ず次の2行構成にする。
  1行目は「対象語句: 」に続けて、誤字や余計な記号を補正した正式な語句だけを書く。
  2行目は説明の本文だけをそのまま書く(「説明:」「説明本文:」のようなラベルや見出しは付けない。前置き・後書きも書かない)。

対象語句: 「${term}」
周辺の文脈(OCRで読み取ったため誤字を含む場合があります): 「${contextLine}」`;
}

// 1行目「対象語句: ...」からOCRの誤字を補正した語句を取り出し、2行目以降を説明本文とする。
// 想定した形式でなければ、生成テキスト全体を説明文として扱い、語句は元のOCR結果のままにする。
function splitTermAndText(rawText, fallbackTerm) {
  const lines = rawText.split(/\r?\n/);
  const m = (lines[0] || '').match(/^対象語句[:：]\s*(.+?)\s*$/);
  if (m && m[1]) {
    const rest = lines.slice(1).join('\n').trim();
    if (rest) return { term: m[1], text: rest };
  }
  return { term: fallbackTerm, text: rawText };
}

// 1回分のAPI呼び出し。useGroundingがtrueならGoogle検索グラウンディングを有効にする
// (課金設定のない無料枠キーでは429になることがあるため、呼び出し側でフォールバックする)。
async function callGemini({ apiKey, model, term, contextLine, tone, useGrounding }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(term, contextLine, tone) }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
  };
  if (useGrounding) body.tools = [{ google_search: {} }];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.error && j.error.message) || '';
    } catch {
      // ignore
    }
    const err = new Error(`APIエラー(${res.status}) ${detail}`.trim());
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function parseResult(json, fallbackTerm) {
  const candidate = json.candidates && json.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const rawText = parts.map((p) => p.text || '').join('').trim();

  if (!rawText) {
    const reason = candidate && candidate.finishReason;
    return {
      ok: false,
      error: reason ? `説明を生成できませんでした(${reason})` : '説明を生成できませんでした。',
    };
  }

  const { term, text } = splitTermAndText(rawText, fallbackTerm);

  const chunks = (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
  const sources = [];
  const seen = new Set();
  for (const c of chunks) {
    const uri = c.web && c.web.uri;
    const title = (c.web && c.web.title) || uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({ title, uri });
    }
    if (sources.length >= 3) break;
  }

  return { ok: true, term, text, sources };
}

async function explainTerm({ term, contextLine, apiKey, model, tone }) {
  if (!apiKey) {
    return { ok: false, error: 'APIキーが設定されていません。マスコットを右クリックして設定してください。' };
  }
  const useModel = model || DEFAULT_MODEL;
  const useTone = tone || '丁寧語で話してください。';

  try {
    const json = await callGemini({ apiKey, model: useModel, term, contextLine, tone: useTone, useGrounding: true });
    return parseResult(json, term);
  } catch (err) {
    // グラウンディング(Google検索)は無料枠キーだと429で使えないことがあるため、
    // その場合だけ通常の生成にフォールバックする(参照元はWikipediaリンクのみになる)。
    if (err.status !== 429) {
      return { ok: false, error: err.message };
    }
  }

  try {
    const json = await callGemini({ apiKey, model: useModel, term, contextLine, tone: useTone, useGrounding: false });
    return parseResult(json, term);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildCodePrompt({ languageLabel, libraryLabels, namedItems, codeExcerpt, truncated, tone }) {
  const namedList = namedItems.map((i) => i.name).join('、') || 'なし';
  return `あなたはプログラミング初心者にも分かりやすく教える、フレンドリーなコード解説者です。
以下のコード(言語: ${languageLabel})について解説してください。

検出されたライブラリ/フレームワーク: ${libraryLabels.join('、') || 'なし'}
${truncated ? '(コードが長いため先頭部分のみ渡しています)' : ''}

制約:
- コードから読み取れる事実のみを述べ、読み取れないことは推測せず「不明」と書く。
- 話し方(口調)は次の指定に従う。ただし言い回しのみに適用し、事実の正確さより優先しない: ${tone}
- 出力は必ず次のJSON形式のみ。前置き・後書き・コードブロック記法(\`\`\`)は一切書かない。
- "items" は下の「解説対象」に挙げた名前だけに対応させる。無い名前を新しく作らない。対象が「なし」ならitemsは空配列にする。

{"summary": "ファイル全体が何をしているかの説明(120字程度)", "items": [{"name": "関数/クラス名", "explanation": "60字程度の説明"}]}

解説対象: ${namedList}

コード:
${codeExcerpt}`;
}

async function explainCode({ languageLabel, libraryLabels, namedItems, codeExcerpt, truncated, apiKey, model, tone }) {
  if (!apiKey) {
    return { ok: false, error: 'APIキーが設定されていません。マスコットを右クリックして設定してください。' };
  }
  const useModel = model || DEFAULT_MODEL;
  const useTone = tone || '丁寧語で話してください。';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: buildCodePrompt({ languageLabel, libraryLabels, namedItems, codeExcerpt, truncated, tone: useTone }) }],
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
  };

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err) {
    return { ok: false, error: `通信に失敗しました: ${err.message}` };
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.error && j.error.message) || '';
    } catch {
      // ignore
    }
    return { ok: false, error: `APIエラー(${res.status}) ${detail}`.trim() };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: '応答の解析に失敗しました。' };
  }

  const candidate = json.candidates && json.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const rawText = parts.map((p) => p.text || '').join('').trim();
  if (!rawText) {
    const reason = candidate && candidate.finishReason;
    return { ok: false, error: reason ? `解説を生成できませんでした(${reason})` : '解説を生成できませんでした。' };
  }

  const cleaned = rawText.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      ok: true,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      items: Array.isArray(parsed.items)
        ? parsed.items.filter((i) => i && typeof i.name === 'string' && typeof i.explanation === 'string')
        : [],
    };
  } catch {
    // JSONとして解釈できなかった場合も、生成された文章自体は概要として活かす
    return { ok: true, summary: cleaned.slice(0, 300), items: [] };
  }
}

function buildDetailPrompt({ text, tone }) {
  return `あなたは学習ノートを作るのが得意な、分かりやすい解説者です。
以下の文章の内容を、初めて学ぶ人にも分かりやすいように、構造化した解説ノートとしてまとめてください。

制約:
- 文章から読み取れる事実のみを述べ、推測や不確かな情報は書かない。専門用語は噛み砕いて説明する。
- 可能であれば、覚え方(語呂合わせや着眼点)や、イメージしやすい例え話を項目ごとに添える。
- 話し方(口調)は次の指定に従う。ただし言い回しのみに適用し、事実の正確さより優先しない: ${tone}
- 出力は必ずMarkdown形式にする。使ってよい要素は見出し(## と ###)・太字(**text**)・箇条書き(-)・番号付きリスト(1. 2. ...)・通常の段落だけ。表・画像・コードブロックは使わない。
- 前置き(「はい、まとめます」等)や後書きは書かない。本文のみを出力する。

対象の文章(OCRで読み取ったため誤字を含む場合があります):
「${text}」`;
}

async function explainDetailed({ text, tone, apiKey, model }) {
  if (!apiKey) {
    return { ok: false, error: 'APIキーが設定されていません。マスコットを右クリックして設定してください。' };
  }
  const useModel = model || DEFAULT_MODEL;
  const useTone = tone || '丁寧語で話してください。';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: buildDetailPrompt({ text, tone: useTone }) }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
  };

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err) {
    return { ok: false, error: `通信に失敗しました: ${err.message}` };
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.error && j.error.message) || '';
    } catch {
      // ignore
    }
    return { ok: false, error: `APIエラー(${res.status}) ${detail}`.trim() };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: '応答の解析に失敗しました。' };
  }

  const candidate = json.candidates && json.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const markdown = parts.map((p) => p.text || '').join('').trim();
  if (!markdown) {
    const reason = candidate && candidate.finishReason;
    return { ok: false, error: reason ? `解説を生成できませんでした(${reason})` : '解説を生成できませんでした。' };
  }

  return { ok: true, markdown };
}

module.exports = { explainTerm, explainCode, explainDetailed, DEFAULT_MODEL };
