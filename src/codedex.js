const fs = require('fs');
const path = require('path');
const { SYNTAX_CATALOG, LIBRARY_CATALOG } = require('./codeCatalog');

function getPath(app) {
  return path.join(app.getPath('userData'), 'codedex.json');
}

function load(app) {
  try {
    return JSON.parse(fs.readFileSync(getPath(app), 'utf-8'));
  } catch {
    return { counts: {}, unknown: {}, lastSeenAt: {} };
  }
}

function save(app, state) {
  const p = getPath(app);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

// 解析結果(syntax/libraries/unknownLibraries)を図鑑の集計に反映する
function recordEncounters(app, analysis) {
  const state = load(app);
  const now = new Date().toISOString();

  for (const { key, count } of analysis.syntax || []) {
    state.counts[key] = (state.counts[key] || 0) + count;
    state.lastSeenAt[key] = now;
  }
  for (const { key, count } of analysis.libraries || []) {
    state.counts[key] = (state.counts[key] || 0) + count;
    state.lastSeenAt[key] = now;
  }
  for (const { name, count } of analysis.unknownLibraries || []) {
    state.unknown[name] = (state.unknown[name] || 0) + count;
    state.lastSeenAt[`unknown:${name}`] = now;
  }

  save(app, state);
  return state;
}

// 静的カタログ(既知の種族一覧)に現在のカウントを重ねて、図鑑表示用の一覧を作る
function getDexEntries(app) {
  const state = load(app);
  const entries = [];

  for (const item of SYNTAX_CATALOG) {
    entries.push({
      key: item.key,
      category: 'syntax',
      label: item.label,
      icon: item.icon,
      description: item.description,
      count: state.counts[item.key] || 0,
      lastSeenAt: state.lastSeenAt[item.key] || null,
    });
  }
  for (const item of LIBRARY_CATALOG) {
    entries.push({
      key: item.key,
      category: 'library',
      label: item.label,
      icon: item.icon,
      description: item.description,
      count: state.counts[item.key] || 0,
      lastSeenAt: state.lastSeenAt[item.key] || null,
    });
  }
  for (const [name, count] of Object.entries(state.unknown || {})) {
    entries.push({
      key: `unknown:${name}`,
      category: 'library',
      label: name,
      icon: '❓',
      description: '図鑑にはまだ登録されていないライブラリ/パッケージです。',
      count,
      lastSeenAt: state.lastSeenAt[`unknown:${name}`] || null,
    });
  }

  return entries;
}

module.exports = { recordEncounters, getDexEntries };
