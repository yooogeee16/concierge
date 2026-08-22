const fs = require('fs');
const path = require('path');
const { SYNTAX_CATALOG, LIBRARY_CATALOG } = require('./codeCatalog');
const { GROUPS } = require('./codeObjectGroups');

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

function objectStoreKey(groupKey, key) {
  return `${groupKey}:${key}`;
}

// 解析結果(syntax/libraries/unknownLibraries/objectGroups)を図鑑の集計に反映する
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
  for (const { groupKey, key, count } of analysis.objectGroups || []) {
    const storeKey = objectStoreKey(groupKey, key);
    state.counts[storeKey] = (state.counts[storeKey] || 0) + count;
    state.lastSeenAt[storeKey] = now;
  }

  save(app, state);
  return state;
}

// 静的カタログ(既知の種族一覧)に現在のカウントを重ねて、図鑑表示用の一覧を作る。
// group/groupLabel/groupIconで、どの「図鑑(コレクション)」に属するかをUI側でまとめられるようにする。
function getDexEntries(app) {
  const state = load(app);
  const entries = [];

  for (const item of SYNTAX_CATALOG) {
    entries.push({
      key: item.key,
      category: 'syntax',
      group: 'syntax',
      groupLabel: '文法要素',
      groupIcon: '📘',
      label: item.label,
      icon: item.icon,
      description: item.description,
      count: state.counts[item.key] || 0,
      lastSeenAt: state.lastSeenAt[item.key] || null,
    });
  }

  // React/pandas/NumPy/Express/Electron(import単位)や、JavaScript/TypeScript/C++/C#
  // (言語単位)など、詳しい図鑑があるものは専用グループにまとめる
  for (const [groupKey, group] of Object.entries(GROUPS)) {
    for (const obj of group.objects) {
      const storeKey = objectStoreKey(groupKey, obj.key);
      entries.push({
        key: storeKey,
        category: group.gate === 'import' ? 'library' : 'language',
        group: groupKey,
        groupLabel: group.label,
        groupIcon: group.icon,
        label: obj.label,
        icon: obj.icon,
        description: obj.description,
        count: state.counts[storeKey] || 0,
        lastSeenAt: state.lastSeenAt[storeKey] || null,
      });
    }
  }

  // 詳しい図鑑を持たないライブラリは「その他ライブラリ」として1枚のカードにまとめる
  for (const item of LIBRARY_CATALOG) {
    if (GROUPS[item.key]) continue;
    entries.push({
      key: item.key,
      category: 'library',
      group: 'misc-library',
      groupLabel: 'その他ライブラリ',
      groupIcon: '📚',
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
      group: 'misc-library',
      groupLabel: 'その他ライブラリ',
      groupIcon: '📚',
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
