// 図鑑の「既知の種族」一覧。ここに載っているものは見つかるたびに説明文付きで表示され、
// 載っていないimport/requireは「その他」として名前だけ動的に図鑑へ追加される。

const SYNTAX_CATALOG = [
  { key: 'function', label: '関数', icon: '🔧', description: '処理をひとまとめにして名前を付けたもの。同じ処理を何度も呼び出せる。' },
  { key: 'class', label: 'クラス', icon: '🏛️', description: 'データと処理をまとめた設計図。オブジェクト指向プログラミングの基本部品。' },
  { key: 'conditional', label: '条件分岐', icon: '🔀', description: 'if/switchなどで、状況に応じて処理を切り替える。' },
  { key: 'loop', label: 'ループ', icon: '🔁', description: 'for/whileなどで、同じ処理を繰り返す。' },
  { key: 'async', label: '非同期処理', icon: '⏳', description: 'async/await・Promiseなど、待ち時間のある処理を止めずに進める仕組み。' },
  { key: 'exception_handling', label: '例外処理', icon: '🛡️', description: 'try/catch(except)で、エラーが起きても処理を止めずに対応する。' },
  { key: 'destructuring', label: '分割代入', icon: '📦', description: '配列やオブジェクトから値をまとめて取り出す書き方。' },
  { key: 'template_literal', label: 'テンプレートリテラル', icon: '✨', description: '文字列の中に変数を埋め込んで書ける記法(`${}`)。' },
  { key: 'module_import', label: 'モジュール読み込み', icon: '📥', description: 'import/requireで、他のファイルやライブラリの機能を取り込む。' },
  { key: 'decorator', label: 'デコレータ', icon: '🎀', description: '関数やクラスに機能を後付けする、目印のような書き方(@から始まる)。' },
  { key: 'comprehension', label: '内包表記', icon: '🧮', description: 'Pythonで、ループとif文をひとまとめにしてリストなどを作る書き方。' },
  { key: 'comment', label: 'コメント', icon: '💬', description: '実行はされない、人間向けのメモ書き。' },
];

// import/require名 -> 図鑑エントリ。キーは小文字・スコープ無しのパッケージ名の先頭部分で判定する。
const LIBRARY_CATALOG = [
  { key: 'react', match: ['react'], label: 'React', icon: '⚛️', description: 'UIを部品(コンポーネント)単位で作るための定番JavaScriptライブラリ。' },
  { key: 'vue', match: ['vue'], label: 'Vue', icon: '💚', description: 'Reactと並ぶ人気のUIフレームワーク。' },
  { key: 'next', match: ['next'], label: 'Next.js', icon: '🔺', description: 'Reactを使ったWebアプリを簡単に作れるフレームワーク。' },
  { key: 'express', match: ['express'], label: 'Express', icon: '🚂', description: 'Node.jsでサーバー(API)を作るための定番ライブラリ。' },
  { key: 'electron', match: ['electron'], label: 'Electron', icon: '⚡', description: 'Webの技術でデスクトップアプリを作れるフレームワーク(このアプリ自体もElectron製)。' },
  { key: 'axios', match: ['axios'], label: 'Axios', icon: '📡', description: 'サーバーとデータをやり取り(HTTP通信)するためのライブラリ。' },
  { key: 'lodash', match: ['lodash'], label: 'Lodash', icon: '🧰', description: '配列やオブジェクトを便利に操作する関数を集めたライブラリ。' },
  { key: 'jquery', match: ['jquery'], label: 'jQuery', icon: '🎯', description: '昔から使われる、HTML操作を簡単にするライブラリ。' },
  { key: 'tailwindcss', match: ['tailwindcss'], label: 'Tailwind CSS', icon: '🎨', description: 'クラス名だけでデザインを組み立てられるCSSフレームワーク。' },
  { key: 'typescript', match: ['typescript'], label: 'TypeScript', icon: '🔷', description: '型を付けられるようにしたJavaScriptの拡張言語。' },
  { key: 'pandas', match: ['pandas'], label: 'pandas', icon: '🐼', description: '表形式のデータを扱うためのPythonライブラリ。' },
  { key: 'numpy', match: ['numpy'], label: 'NumPy', icon: '🔢', description: '数値計算・配列演算を高速に行うPythonライブラリ。' },
  { key: 'flask', match: ['flask'], label: 'Flask', icon: '🍶', description: 'Pythonで手軽にWebサーバーを作れる軽量フレームワーク。' },
  { key: 'django', match: ['django'], label: 'Django', icon: '🎸', description: 'Pythonの本格的なWebフレームワーク。' },
  { key: 'fastapi', match: ['fastapi'], label: 'FastAPI', icon: '🚀', description: '型を活かして高速にAPIを作れるPythonフレームワーク。' },
  { key: 'tensorflow', match: ['tensorflow'], label: 'TensorFlow', icon: '🧠', description: '機械学習・深層学習を行うためのライブラリ。' },
  { key: 'torch', match: ['torch'], label: 'PyTorch', icon: '🔥', description: '機械学習・深層学習を行うためのライブラリ(TensorFlowと双璧)。' },
  { key: 'requests', match: ['requests'], label: 'Requests', icon: '🌐', description: 'PythonでHTTP通信を行う定番ライブラリ。' },
];

function findLibraryCatalogEntry(importName) {
  const head = importName.replace(/^@[^/]+\//, '').split('/')[0].toLowerCase();
  return LIBRARY_CATALOG.find((lib) => lib.match.includes(head));
}

function getSyntaxEntry(key) {
  return SYNTAX_CATALOG.find((s) => s.key === key);
}

function getLibraryEntry(key) {
  return LIBRARY_CATALOG.find((l) => l.key === key);
}

module.exports = { SYNTAX_CATALOG, LIBRARY_CATALOG, findLibraryCatalogEntry, getSyntaxEntry, getLibraryEntry };
