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
function saveEntry(app, entry) {
  const list = loadDictionary(app);
  const record = {
    term: entry.term,
    text: entry.text,
    sources: entry.sources || [],
    savedAt: new Date().toISOString(),
  };
  const idx = list.findIndex((e) => e.term === record.term);
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

module.exports = { loadDictionary, saveEntry, deleteEntry };
