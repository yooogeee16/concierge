const { findLibraryCatalogEntry } = require('./codeCatalog');

const EXT_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python',
  c: 'c', h: 'c',
};
const LANG_LABEL = { javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', c: 'C' };
const JS_FAMILY = new Set(['javascript', 'typescript']);
const C_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return']);

const MAX_CODE_CHARS = 8000; // Gemini/表示に渡す上限(暴走・長すぎるプロンプト防止)
const MAX_NAMED_ITEMS = 12; // 個別に解説を依頼する関数/クラスの上限

function detectLanguage(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const id = EXT_LANG[ext] || 'unknown';
  return { id, label: LANG_LABEL[id] || (ext ? ext.toUpperCase() : '不明'), ext };
}

function countMatches(re, text) {
  const m = text.match(re);
  return m ? m.length : 0;
}

// 見た目上の行番号(1始まり)を、文字列インデックスから求める
function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function analyzeSyntaxJs(code) {
  const counts = {};
  counts.function = countMatches(/\bfunction\b/g, code) + countMatches(/=>/g, code);
  counts.class = countMatches(/\bclass\s+\w+/g, code);
  counts.conditional = countMatches(/\bif\s*\(/g, code) + countMatches(/\bswitch\s*\(/g, code);
  counts.loop =
    countMatches(/\bfor\s*\(/g, code) +
    countMatches(/\bwhile\s*\(/g, code) +
    countMatches(/\.(forEach|map|filter|reduce)\s*\(/g, code);
  counts.async = countMatches(/\basync\b/g, code) + countMatches(/\bawait\b/g, code) + countMatches(/\bPromise\b/g, code);
  counts.exception_handling = countMatches(/\btry\s*\{/g, code) + countMatches(/\bcatch\s*\(/g, code);
  counts.destructuring = countMatches(/\b(?:const|let|var)\s*[{[]/g, code);
  counts.template_literal = countMatches(/\$\{/g, code);
  counts.module_import = countMatches(/\bimport\s+[\s\S]*?from\s+['"]/g, code) + countMatches(/\brequire\(/g, code);
  counts.decorator = countMatches(/^\s*@\w+/gm, code);
  counts.comment = countMatches(/\/\/.*$/gm, code) + countMatches(/\/\*[\s\S]*?\*\//g, code);
  return counts;
}

function analyzeSyntaxPython(code) {
  const counts = {};
  counts.function = countMatches(/\bdef\s+\w+\s*\(/g, code);
  counts.class = countMatches(/\bclass\s+\w+/g, code);
  counts.conditional = countMatches(/\b(if|elif)\b/g, code);
  counts.loop = countMatches(/\b(for|while)\b/g, code);
  counts.async = countMatches(/\basync\s+def\b/g, code) + countMatches(/\bawait\b/g, code);
  counts.exception_handling = countMatches(/\btry\s*:/g, code) + countMatches(/\bexcept\b/g, code);
  counts.destructuring = countMatches(/^\s*\(?\w+\s*,\s*\w+[\w,\s]*\)?\s*=\s*[^=]/gm, code);
  counts.template_literal = countMatches(/f['"]/g, code);
  counts.module_import = countMatches(/^\s*(import|from)\s+\w/gm, code);
  counts.decorator = countMatches(/^\s*@\w+/gm, code);
  counts.comprehension =
    countMatches(/\[[^[\]]*\bfor\b[^[\]]*\bin\b[^[\]]*\]/g, code) +
    countMatches(/\([^()]*\bfor\b[^()]*\bin\b[^()]*\)/g, code);
  counts.comment = countMatches(/#.*/g, code) + countMatches(/"""[\s\S]*?"""/g, code) + countMatches(/'''[\s\S]*?'''/g, code);
  return counts;
}

// C言語はfunctionキーワードやclassを持たないため、関数定義は
// 「識別子 ( ... ) {」の形(制御構文のキーワードは除く)で近似検出する。
function analyzeSyntaxC(code) {
  const counts = {};
  const funcDefRe = /\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
  let funcCount = 0;
  let m;
  while ((m = funcDefRe.exec(code))) {
    if (!C_CONTROL_KEYWORDS.has(m[1])) funcCount++;
  }
  counts.function = funcCount;
  counts.struct = countMatches(/\bstruct\s+\w+\s*\{/g, code);
  counts.pointer = countMatches(/\w\s*\*\s*\w/g, code) + countMatches(/&\w/g, code);
  counts.conditional = countMatches(/\bif\s*\(/g, code) + countMatches(/\bswitch\s*\(/g, code);
  counts.loop = countMatches(/\bfor\s*\(/g, code) + countMatches(/\bwhile\s*\(/g, code) + countMatches(/\bdo\s*\{/g, code);
  counts.module_import = countMatches(/#include\s*[<"][^">]+[>"]/g, code);
  counts.comment = countMatches(/\/\/.*$/gm, code) + countMatches(/\/\*[\s\S]*?\*\//g, code);
  return counts;
}

function extractLibrariesC(code) {
  const names = [];
  const re = /#include\s*[<"]([^">]+)[>"]/g;
  let m;
  while ((m = re.exec(code))) names.push(m[1]);
  return names;
}

function extractNamedItemsC(code) {
  const items = [];
  const re = /(?:^|\n)\s*[A-Za-z_][\w\s*]*?\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
  let m;
  while ((m = re.exec(code))) {
    if (!C_CONTROL_KEYWORDS.has(m[1])) items.push({ name: m[1], line: lineAt(code, m.index) });
  }
  return items;
}

function extractLibrariesJs(code) {
  const names = [];
  const importRe = /import\s+(?:[\s\S]*?)from\s+['"]([^'"]+)['"]/g;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = importRe.exec(code))) names.push(m[1]);
  while ((m = requireRe.exec(code))) names.push(m[1]);
  return names.filter((n) => n && !n.startsWith('.') && !n.startsWith('/'));
}

function extractLibrariesPython(code) {
  const names = [];
  const re = /^\s*(?:import|from)\s+([\w.]+)/gm;
  let m;
  while ((m = re.exec(code))) names.push(m[1].split('.')[0]);
  return names.filter(Boolean);
}

function extractNamedItemsJs(code) {
  const items = [];
  const patterns = [
    /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+(\w+)/g,
    /(?:^|\n)\s*class\s+(\w+)/g,
    /(?:^|\n)\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) {
      items.push({ name: m[1], line: lineAt(code, m.index) });
    }
  }
  return items;
}

function extractNamedItemsPython(code) {
  const items = [];
  const patterns = [/(?:^|\n)\s*(?:async\s+)?def\s+(\w+)/g, /(?:^|\n)\s*class\s+(\w+)/g];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) {
      items.push({ name: m[1], line: lineAt(code, m.index) });
    }
  }
  return items;
}

// コード全体を解析し、図鑑用のカウントと、個別解説対象の関数/クラス一覧を返す
function analyzeCode(filename, rawCode) {
  const { id: languageId, label: languageLabel } = detectLanguage(filename);
  const truncated = rawCode.length > MAX_CODE_CHARS;
  const code = truncated ? rawCode.slice(0, MAX_CODE_CHARS) : rawCode;

  let syntaxCounts = {};
  let libraryNames = [];
  let namedItems = [];

  if (JS_FAMILY.has(languageId)) {
    syntaxCounts = analyzeSyntaxJs(code);
    libraryNames = extractLibrariesJs(code);
    namedItems = extractNamedItemsJs(code);
  } else if (languageId === 'python') {
    syntaxCounts = analyzeSyntaxPython(code);
    libraryNames = extractLibrariesPython(code);
    namedItems = extractNamedItemsPython(code);
  } else if (languageId === 'c') {
    syntaxCounts = analyzeSyntaxC(code);
    libraryNames = extractLibrariesC(code);
    namedItems = extractNamedItemsC(code);
  }

  const syntax = Object.entries(syntaxCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }));

  const libraryCounts = new Map(); // catalogKey -> count
  const unknownCounts = new Map(); // rawName -> count
  for (const name of libraryNames) {
    const entry = findLibraryCatalogEntry(name);
    if (entry) {
      libraryCounts.set(entry.key, (libraryCounts.get(entry.key) || 0) + 1);
    } else {
      unknownCounts.set(name, (unknownCounts.get(name) || 0) + 1);
    }
  }

  return {
    languageId,
    languageLabel,
    truncated,
    codeExcerpt: code,
    syntax,
    libraries: [...libraryCounts.entries()].map(([key, count]) => ({ key, count })),
    unknownLibraries: [...unknownCounts.entries()].map(([name, count]) => ({ name, count })),
    namedItems: namedItems.slice(0, MAX_NAMED_ITEMS),
  };
}

module.exports = { analyzeCode, detectLanguage };
