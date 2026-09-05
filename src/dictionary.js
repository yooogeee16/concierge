const fs = require('fs');
const path = require('path');

function getDictPath(app) {
  return path.join(app.getPath('userData'), 'dictionary.json');
}

function loadDictionary(app) {
  try {
    return JSON.parse(fs.readFileSync(getDictPath(app), 'utf-8'));
  } catch {
    return [];
  }
}

function writeDictionary(app, list) {
  const p = getDictPath(app);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf-8');
}

// 同じ語句が既に登録されていれば、新しい説明で上書きする
// (出題履歴lastQuizzedAt・回答lastResponseは引き継ぐ)
function saveEntry(app, entry) {
  const list = loadDictionary(app);
  const idx = list.findIndex((e) => e.term === entry.term);
  const previous = idx >= 0 ? list[idx] : null;
  const record = {
    term: entry.term,
    text: entry.text,
    sources: entry.sources || [],
    savedAt: new Date().toISOString(),
    lastQuizzedAt: (previous && previous.lastQuizzedAt) || null,
    lastResponse: (previous && previous.lastResponse) || null,
  };
  if (idx >= 0) list[idx] = record;
  else list.unshift(record);
  writeDictionary(app, list);
  return record;
}

function deleteEntry(app, term) {
  const list = loadDictionary(app).filter((e) => e.term !== term);
  writeDictionary(app, list);
  return list;
}

// クイズに出したことを記録する(まだ出題していない語句を優先して選べるようにするため)
function markQuizzed(app, term) {
  const list = loadDictionary(app);
  const idx = list.findIndex((e) => e.term === term);
  if (idx < 0) return;
  list[idx].lastQuizzedAt = new Date().toISOString();
  writeDictionary(app, list);
}

// クイズで「覚えてる」「覚えてない」のどちらを押したかを記録する
function markResponse(app, term, response) {
  const list = loadDictionary(app);
  const idx = list.findIndex((e) => e.term === term);
  if (idx < 0) return;
  list[idx].lastResponse = response === 'forgot' ? 'forgot' : 'remembered';
  writeDictionary(app, list);
}

const FORGOT_WEIGHT = 5; // 「覚えてない」と答えた語句は、他の語句よりこの倍率だけ出題されやすくする
const NORMAL_WEIGHT = 1;

// 1. まだ出題していない語句(lastQuizzedAtが無いもの)を最優先で選ぶ。
// 2. 全て出題済みなら、「覚えてない」と答えた語句を優先しつつ、
//    「覚えてる」と答えた語句や未回答の語句もたまに混ざるよう重み付き抽選する。
function pickQuizEntry(entries) {
  const neverQuizzed = entries.filter((e) => !e.lastQuizzedAt);
  if (neverQuizzed.length > 0) {
    return neverQuizzed[Math.floor(Math.random() * neverQuizzed.length)];
  }

  const weighted = entries.map((e) => ({
    entry: e,
    weight: e.lastResponse === 'forgot' ? FORGOT_WEIGHT : NORMAL_WEIGHT,
  }));
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of weighted) {
    if (roll < w.weight) return w.entry;
    roll -= w.weight;
  }
  return weighted[weighted.length - 1].entry;
}

module.exports = { loadDictionary, saveEntry, deleteEntry, markQuizzed, markResponse, pickQuizEntry };
