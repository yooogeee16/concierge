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

// 語句を3つのグループに分け、グループごとに出題される確率を固定する。
// (個数ではなく確率をグループ単位で固定するのがポイント。例えば「覚えてる」に
// 分類された語句がどれだけ増えても、全体としての出題率はOTHER_RATIOのまま変わらない
// ようにすることで、数が多いだけの語句ばかり出題される偏りを防ぐ)
// この重み付け(FOCUSED)と、完全に均等な抽選(UNIFORM)の間を「ランダム性」で補間する。
const FOCUSED_RATIOS = { new: 0.5, forgot: 0.35, other: 0.15 };
const UNIFORM_RATIOS = { new: 1 / 3, forgot: 1 / 3, other: 1 / 3 };
const DEFAULT_QUIZ_RANDOMNESS = 60; // 0(重み付け通り)〜100(完全均等)。設定未指定時のデフォルト

// randomness: 0〜100。0でFOCUSED_RATIOSそのまま、100で完全に均等(UNIFORM_RATIOS)な抽選になる
function pickQuizEntry(entries, randomness) {
  const r =
    Math.max(0, Math.min(100, typeof randomness === 'number' ? randomness : DEFAULT_QUIZ_RANDOMNESS)) / 100;

  const tiers = {
    new: entries.filter((e) => !e.lastQuizzedAt),
    forgot: entries.filter((e) => e.lastQuizzedAt && e.lastResponse === 'forgot'),
    other: entries.filter((e) => e.lastQuizzedAt && e.lastResponse !== 'forgot'),
  };
  const ratios = {};
  for (const key of Object.keys(FOCUSED_RATIOS)) {
    ratios[key] = FOCUSED_RATIOS[key] * (1 - r) + UNIFORM_RATIOS[key] * r;
  }

  // 中身が空のグループはくじから除外し、残ったグループの比率で抽選する
  const available = Object.keys(ratios).filter((key) => tiers[key].length > 0);
  if (available.length === 0) return null;

  const total = available.reduce((sum, key) => sum + ratios[key], 0);
  let roll = Math.random() * total;
  let chosenTier = available[available.length - 1];
  for (const key of available) {
    if (roll < ratios[key]) {
      chosenTier = key;
      break;
    }
    roll -= ratios[key];
  }

  const pool = tiers[chosenTier];
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  loadDictionary,
  saveEntry,
  deleteEntry,
  markQuizzed,
  markResponse,
  pickQuizEntry,
  DEFAULT_QUIZ_RANDOMNESS,
};
