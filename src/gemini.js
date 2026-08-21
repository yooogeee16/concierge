// 無料枠でも安定して使えることを確認済みのモデル。設定でmodelを指定すれば上書きできる。
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

function buildPrompt(term, contextLine, tone) {
  return `あなたは、画面上でユーザーがカーソルを合わせた語句を説明するアシスタントです。
以下の「対象語句」について、100〜150文字程度の日本語で、正確さを最優先にわかりやすく説明してください。

制約:
- 確実に分かっている事実のみを述べ、推測や不確かな情報は書かない。
- 語句の意味が複数考えられる場合は、周辺の文脈から最も妥当な1つを選んで説明する。
- 対象語句が固有名詞・専門用語・略語などで確信が持てない場合は、断定を避けるか「情報が不十分で断定できません」と正直に答える。
- 説明文以外の前置き・後書き(「はい、説明します」等)は書かない。本文のみを出力する。
- 話し方(口調)は次の指定に従う。ただし、この指定は言い回しのみに適用し、事実の正確さより優先しない: ${tone}

対象語句: 「${term}」
周辺の文脈(OCRで読み取ったため誤字を含む場合があります): 「${contextLine}」`;
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

function parseResult(json) {
  const candidate = json.candidates && json.candidates[0];
  const parts = (candidate && candidate.content && candidate.content.parts) || [];
  const text = parts.map((p) => p.text || '').join('').trim();

  if (!text) {
    const reason = candidate && candidate.finishReason;
    return {
      ok: false,
      error: reason ? `説明を生成できませんでした(${reason})` : '説明を生成できませんでした。',
    };
  }

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

  return { ok: true, text, sources };
}

async function explainTerm({ term, contextLine, apiKey, model, tone }) {
  if (!apiKey) {
    return { ok: false, error: 'APIキーが設定されていません。マスコットを右クリックして設定してください。' };
  }
  const useModel = model || DEFAULT_MODEL;
  const useTone = tone || '丁寧語で話してください。';

  try {
    const json = await callGemini({ apiKey, model: useModel, term, contextLine, tone: useTone, useGrounding: true });
    return parseResult(json);
  } catch (err) {
    // グラウンディング(Google検索)は無料枠キーだと429で使えないことがあるため、
    // その場合だけ通常の生成にフォールバックする(参照元はWikipediaリンクのみになる)。
    if (err.status !== 429) {
      return { ok: false, error: err.message };
    }
  }

  try {
    const json = await callGemini({ apiKey, model: useModel, term, contextLine, tone: useTone, useGrounding: false });
    return parseResult(json);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { explainTerm, DEFAULT_MODEL };
