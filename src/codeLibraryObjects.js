// 主要ライブラリごとの「具体的なオブジェクト」図鑑。
// LIBRARY_CATALOGの各ライブラリが実際にimportされていた場合だけ、
// ここに定義されたパターンでコード全体を走査して個別の関数/フックの使用を検出する。

const REACT_OBJECTS = [
  { key: 'useState', label: 'useState', icon: '🪝', description: '状態(値)を持たせ、更新するとUIを再描画させるフック。', pattern: /\buseState\s*\(/g },
  { key: 'useEffect', label: 'useEffect', icon: '🪝', description: '描画後に副作用(データ取得など)を実行するフック。', pattern: /\buseEffect\s*\(/g },
  { key: 'useContext', label: 'useContext', icon: '🪝', description: '親から渡されたContextの値を読み取るフック。', pattern: /\buseContext\s*\(/g },
  { key: 'useReducer', label: 'useReducer', icon: '🪝', description: '複雑な状態更新をreducer関数でまとめて管理するフック。', pattern: /\buseReducer\s*\(/g },
  { key: 'useMemo', label: 'useMemo', icon: '🪝', description: '計算結果を再利用してムダな再計算を防ぐフック。', pattern: /\buseMemo\s*\(/g },
  { key: 'useCallback', label: 'useCallback', icon: '🪝', description: '関数そのものを再利用してムダな再生成を防ぐフック。', pattern: /\buseCallback\s*\(/g },
  { key: 'useRef', label: 'useRef', icon: '🪝', description: '再描画をまたいで値やDOM要素を保持するフック。', pattern: /\buseRef\s*\(/g },
  { key: 'useLayoutEffect', label: 'useLayoutEffect', icon: '🪝', description: '描画直後、画面反映前に同期的に実行される副作用フック。', pattern: /\buseLayoutEffect\s*\(/g },
  { key: 'useImperativeHandle', label: 'useImperativeHandle', icon: '🪝', description: 'refで公開する内容をカスタマイズするフック。', pattern: /\buseImperativeHandle\s*\(/g },
  { key: 'useTransition', label: 'useTransition', icon: '🪝', description: '重い更新を優先度低めにして体感速度を保つフック。', pattern: /\buseTransition\s*\(/g },
  { key: 'useDeferredValue', label: 'useDeferredValue', icon: '🪝', description: '値の反映を遅延させ、描画のカクつきを抑えるフック。', pattern: /\buseDeferredValue\s*\(/g },
  { key: 'useId', label: 'useId', icon: '🪝', description: 'サーバー/クライアントで一致する一意なIDを生成するフック。', pattern: /\buseId\s*\(/g },
  { key: 'useSyncExternalStore', label: 'useSyncExternalStore', icon: '🪝', description: '外部ストアの値をReactの状態として購読するフック。', pattern: /\buseSyncExternalStore\s*\(/g },
  { key: 'useDebugValue', label: 'useDebugValue', icon: '🪝', description: '開発者ツールにカスタムフックの値を表示するフック。', pattern: /\buseDebugValue\s*\(/g },
  { key: 'useInsertionEffect', label: 'useInsertionEffect', icon: '🪝', description: 'CSS-in-JSライブラリ向けの、描画前に実行される特殊なフック。', pattern: /\buseInsertionEffect\s*\(/g },
  { key: 'react_component', label: 'Component', icon: '🏛️', description: '状態やライフサイクルを持てる、クラス形式のコンポーネントの基底クラス。', pattern: /\bComponent\b/g },
  { key: 'PureComponent', label: 'PureComponent', icon: '🏛️', description: 'propsやstateが変わらなければ再描画しないComponent。', pattern: /\bPureComponent\b/g },
  { key: 'react_fragment', label: 'Fragment', icon: '🧩', description: '余計なDOM要素を増やさずに複数要素をまとめる入れ物。', pattern: /\bFragment\b|<>/g },
  { key: 'StrictMode', label: 'StrictMode', icon: '🔍', description: '開発中に問題のあるコードを検出しやすくするモード。', pattern: /\bStrictMode\b/g },
  { key: 'Suspense', label: 'Suspense', icon: '⏱️', description: '非同期に読み込み中のコンポーネントの代わりに表示を出す仕組み。', pattern: /\bSuspense\b/g },
  { key: 'react_memo', label: 'memo', icon: '🧠', description: 'propsが変わらなければ再描画をスキップする最適化。', pattern: /\bmemo\s*\(/g },
  { key: 'forwardRef', label: 'forwardRef', icon: '➡️', description: '親からのrefを子のDOM要素に転送する仕組み。', pattern: /\bforwardRef\s*\(/g },
  { key: 'react_lazy', label: 'lazy', icon: '🐢', description: 'コンポーネントを必要になるまで読み込みを遅らせる仕組み。', pattern: /\blazy\s*\(/g },
  { key: 'createContext', label: 'createContext', icon: '🌐', description: 'コンポーネントツリー全体で共有できる値(Context)を作る。', pattern: /\bcreateContext\s*\(/g },
  { key: 'createElement', label: 'createElement', icon: '🏗️', description: 'JSXが変換された先にある、要素を作る関数。', pattern: /\bcreateElement\s*\(/g },
  { key: 'cloneElement', label: 'cloneElement', icon: '📄', description: '既存の要素をpropsを変えつつ複製する関数。', pattern: /\bcloneElement\s*\(/g },
  { key: 'createRef', label: 'createRef', icon: '📌', description: 'DOM要素やインスタンスを参照するためのrefオブジェクトを作る(クラス用)。', pattern: /\bcreateRef\s*\(/g },
  { key: 'react_children', label: 'Children', icon: '👶', description: 'props.childrenを安全に操作するためのユーティリティ。', pattern: /\bChildren\./g },
];

const PANDAS_OBJECTS = [
  { key: 'DataFrame', label: 'DataFrame', icon: '📊', description: '表形式のデータを扱う、pandasの中心となるデータ構造。', pattern: /\bDataFrame\s*\(/g },
  { key: 'pd_Series', label: 'Series', icon: '📈', description: '1列分のデータを扱う、pandasの基本データ構造。', pattern: /\bSeries\s*\(/g },
  { key: 'read_csv', label: 'read_csv', icon: '📥', description: 'CSVファイルを読み込んでDataFrameにする。', pattern: /\bread_csv\s*\(/g },
  { key: 'read_excel', label: 'read_excel', icon: '📥', description: 'Excelファイルを読み込んでDataFrameにする。', pattern: /\bread_excel\s*\(/g },
  { key: 'read_json', label: 'read_json', icon: '📥', description: 'JSONを読み込んでDataFrameにする。', pattern: /\bread_json\s*\(/g },
  { key: 'read_sql', label: 'read_sql', icon: '📥', description: 'SQLの実行結果をDataFrameとして読み込む。', pattern: /\bread_sql\s*\(/g },
  { key: 'to_csv', label: 'to_csv', icon: '📤', description: 'DataFrameをCSVファイルとして書き出す。', pattern: /\.to_csv\s*\(/g },
  { key: 'to_excel', label: 'to_excel', icon: '📤', description: 'DataFrameをExcelファイルとして書き出す。', pattern: /\.to_excel\s*\(/g },
  { key: 'pd_merge', label: 'merge', icon: '🔗', description: '共通のキーをもとに2つの表を結合する。', pattern: /\bmerge\s*\(/g },
  { key: 'pd_concat', label: 'concat', icon: '🧵', description: '複数のDataFrame/Seriesを縦や横につなげる。', pattern: /\bconcat\s*\(/g },
  { key: 'groupby', label: 'groupby', icon: '🗂️', description: '特定の列の値でグループ分けして集計する。', pattern: /\.groupby\s*\(/g },
  { key: 'pivot_table', label: 'pivot_table', icon: '🔄', description: '行と列を入れ替えて集計表(ピボットテーブル)を作る。', pattern: /\bpivot_table\s*\(/g },
  { key: 'pd_head', label: 'head', icon: '🔎', description: '先頭の数行だけを取り出して確認する。', pattern: /\.head\s*\(/g },
  { key: 'pd_tail', label: 'tail', icon: '🔎', description: '末尾の数行だけを取り出して確認する。', pattern: /\.tail\s*\(/g },
  { key: 'describe', label: 'describe', icon: '📋', description: '平均・最大・最小などの統計量をまとめて表示する。', pattern: /\.describe\s*\(/g },
  { key: 'pd_info', label: 'info', icon: 'ℹ️', description: '列の型や欠損値の状況などをまとめて表示する。', pattern: /\.info\s*\(/g },
  { key: 'dropna', label: 'dropna', icon: '🧹', description: '欠損値(NaN)を含む行/列を取り除く。', pattern: /\.dropna\s*\(/g },
  { key: 'fillna', label: 'fillna', icon: '🩹', description: '欠損値(NaN)を指定した値で埋める。', pattern: /\.fillna\s*\(/g },
  { key: 'pd_drop', label: 'drop', icon: '✂️', description: '指定した行/列を取り除く。', pattern: /\.drop\s*\(/g },
  { key: 'rename', label: 'rename', icon: '🏷️', description: '列名や行名を変更する。', pattern: /\.rename\s*\(/g },
  { key: 'sort_values', label: 'sort_values', icon: '🔢', description: '値の大きさ順に並べ替える。', pattern: /\.sort_values\s*\(/g },
  { key: 'sort_index', label: 'sort_index', icon: '🔢', description: 'インデックス(行の番号やラベル)順に並べ替える。', pattern: /\.sort_index\s*\(/g },
  { key: 'pd_apply', label: 'apply', icon: '🛠️', description: '各行/列に任意の関数を適用する。', pattern: /\.apply\s*\(/g },
  { key: 'loc', label: 'loc', icon: '📍', description: 'ラベル名で行/列を指定して取り出す。', pattern: /\.loc\[/g },
  { key: 'iloc', label: 'iloc', icon: '📍', description: '位置番号で行/列を指定して取り出す。', pattern: /\.iloc\[/g },
  { key: 'value_counts', label: 'value_counts', icon: '🧮', description: '値ごとの出現回数を数える。', pattern: /\.value_counts\s*\(/g },
  { key: 'pd_unique', label: 'unique', icon: '🔑', description: '重複を除いたユニークな値の一覧を取り出す。', pattern: /\.unique\s*\(/g },
  { key: 'set_index', label: 'set_index', icon: '📌', description: '特定の列を新しいインデックス(行の見出し)に設定する。', pattern: /\.set_index\s*\(/g },
];

const NUMPY_OBJECTS = [
  { key: 'np_array', label: 'array', icon: '🧊', description: 'リストなどからNumPyの配列(ndarray)を作る。', pattern: /\bnp\.array\s*\(/g },
  { key: 'np_zeros', label: 'zeros', icon: '0️⃣', description: '全ての要素が0の配列を作る。', pattern: /\bnp\.zeros\s*\(/g },
  { key: 'np_ones', label: 'ones', icon: '1️⃣', description: '全ての要素が1の配列を作る。', pattern: /\bnp\.ones\s*\(/g },
  { key: 'arange', label: 'arange', icon: '📏', description: '決まった間隔で並ぶ数列の配列を作る。', pattern: /\bnp\.arange\s*\(/g },
  { key: 'linspace', label: 'linspace', icon: '📐', description: '指定した範囲を等間隔に分割した配列を作る。', pattern: /\bnp\.linspace\s*\(/g },
  { key: 'reshape', label: 'reshape', icon: '🔲', description: '配列の形(次元)を変える。', pattern: /\.reshape\s*\(/g },
  { key: 'np_transpose', label: 'transpose', icon: '🔄', description: '行と列を入れ替える(転置する)。', pattern: /\bnp\.transpose\s*\(|\.T\b/g },
  { key: 'np_dot', label: 'dot', icon: '✖️', description: '行列やベクトルの内積を計算する。', pattern: /\bnp\.dot\s*\(/g },
  { key: 'matmul', label: 'matmul', icon: '✖️', description: '行列同士の掛け算(行列積)を計算する。', pattern: /\bnp\.matmul\s*\(/g },
  { key: 'np_sum', label: 'sum', icon: '➕', description: '配列の要素の合計を計算する。', pattern: /\bnp\.sum\s*\(/g },
  { key: 'np_mean', label: 'mean', icon: '📊', description: '配列の要素の平均を計算する。', pattern: /\bnp\.mean\s*\(/g },
  { key: 'np_std', label: 'std', icon: '📊', description: '配列の要素の標準偏差を計算する。', pattern: /\bnp\.std\s*\(/g },
  { key: 'np_var', label: 'var', icon: '📊', description: '配列の要素の分散を計算する。', pattern: /\bnp\.var\s*\(/g },
  { key: 'np_min', label: 'min', icon: '🔽', description: '配列の中の最小値を求める。', pattern: /\bnp\.min\s*\(/g },
  { key: 'np_max', label: 'max', icon: '🔼', description: '配列の中の最大値を求める。', pattern: /\bnp\.max\s*\(/g },
  { key: 'argmax', label: 'argmax', icon: '🎯', description: '最大値がある位置(インデックス)を求める。', pattern: /\bnp\.argmax\s*\(/g },
  { key: 'argmin', label: 'argmin', icon: '🎯', description: '最小値がある位置(インデックス)を求める。', pattern: /\bnp\.argmin\s*\(/g },
  { key: 'np_sort', label: 'sort', icon: '🔢', description: '配列の要素を並べ替える。', pattern: /\bnp\.sort\s*\(/g },
  { key: 'concatenate', label: 'concatenate', icon: '🧵', description: '複数の配列をつなげる。', pattern: /\bnp\.concatenate\s*\(/g },
  { key: 'np_stack', label: 'stack', icon: '📚', description: '複数の配列を新しい軸に沿って積み重ねる。', pattern: /\bnp\.stack\s*\(/g },
  { key: 'np_where', label: 'where', icon: '🔀', description: '条件に応じて値を選ぶ(条件分岐を配列全体に適用)。', pattern: /\bnp\.where\s*\(/g },
  { key: 'np_random', label: 'random', icon: '🎲', description: '乱数を生成するための機能群。', pattern: /\bnp\.random\./g },
  { key: 'np_sqrt', label: 'sqrt', icon: '√', description: '平方根を計算する。', pattern: /\bnp\.sqrt\s*\(/g },
  { key: 'np_exp', label: 'exp', icon: '📈', description: '指数関数(eのべき乗)を計算する。', pattern: /\bnp\.exp\s*\(/g },
];

const EXPRESS_OBJECTS = [
  { key: 'express_factory', label: 'express()', icon: '🚂', description: 'Expressアプリ本体を作成する。', pattern: /\bexpress\s*\(\s*\)/g },
  { key: 'Router', label: 'Router', icon: '🛤️', description: 'ルーティングをまとめて管理する部品を作る。', pattern: /\b(?:express\.)?Router\s*\(/g },
  { key: 'app_get', label: 'app.get', icon: '📥', description: 'GETリクエストに対する処理を登録する。', pattern: /\bapp\.get\s*\(/g },
  { key: 'app_post', label: 'app.post', icon: '📮', description: 'POSTリクエストに対する処理を登録する。', pattern: /\bapp\.post\s*\(/g },
  { key: 'app_put', label: 'app.put', icon: '✏️', description: 'PUTリクエストに対する処理を登録する。', pattern: /\bapp\.put\s*\(/g },
  { key: 'app_delete', label: 'app.delete', icon: '🗑️', description: 'DELETEリクエストに対する処理を登録する。', pattern: /\bapp\.delete\s*\(/g },
  { key: 'app_patch', label: 'app.patch', icon: '🩹', description: 'PATCHリクエストに対する処理を登録する。', pattern: /\bapp\.patch\s*\(/g },
  { key: 'app_use', label: 'app.use', icon: '🧩', description: 'ミドルウェア(共通処理)を組み込む。', pattern: /\bapp\.use\s*\(/g },
  { key: 'app_listen', label: 'app.listen', icon: '👂', description: '指定したポートでサーバーを起動する。', pattern: /\bapp\.listen\s*\(/g },
  { key: 'app_set', label: 'app.set', icon: '⚙️', description: 'アプリ全体の設定値を登録する。', pattern: /\bapp\.set\s*\(/g },
  { key: 'req_body', label: 'req.body', icon: '📦', description: 'リクエストの本文(送信されたデータ)を取得する。', pattern: /\breq\.body\b/g },
  { key: 'req_params', label: 'req.params', icon: '🔗', description: 'URLのパスパラメータを取得する。', pattern: /\breq\.params\b/g },
  { key: 'req_query', label: 'req.query', icon: '❓', description: 'URLのクエリパラメータを取得する。', pattern: /\breq\.query\b/g },
  { key: 'req_headers', label: 'req.headers', icon: '📋', description: 'リクエストのヘッダー情報を取得する。', pattern: /\breq\.headers\b/g },
  { key: 'res_send', label: 'res.send', icon: '📤', description: 'レスポンスを返す(汎用)。', pattern: /\bres\.send\s*\(/g },
  { key: 'res_json', label: 'res.json', icon: '🧾', description: 'JSON形式でレスポンスを返す。', pattern: /\bres\.json\s*\(/g },
  { key: 'res_status', label: 'res.status', icon: '🔢', description: 'HTTPステータスコードを設定する。', pattern: /\bres\.status\s*\(/g },
  { key: 'res_redirect', label: 'res.redirect', icon: '↪️', description: '別のURLへリダイレクトさせる。', pattern: /\bres\.redirect\s*\(/g },
  { key: 'express_next', label: 'next', icon: '⏭️', description: '次のミドルウェア/ハンドラへ処理を渡す。', pattern: /\bnext\s*\(\s*\)/g },
  { key: 'express_static', label: 'express.static', icon: '🗄️', description: '静的ファイル(画像やCSSなど)を配信する。', pattern: /\bexpress\.static\s*\(/g },
  { key: 'express_json', label: 'express.json', icon: '🧾', description: 'JSON形式のリクエストボディを解析するミドルウェア。', pattern: /\bexpress\.json\s*\(/g },
  { key: 'express_urlencoded', label: 'express.urlencoded', icon: '📝', description: 'フォーム送信データを解析するミドルウェア。', pattern: /\bexpress\.urlencoded\s*\(/g },
];

const LIBRARY_GROUPS = {
  react: { label: 'React', icon: '⚛️', objects: REACT_OBJECTS },
  pandas: { label: 'pandas', icon: '🐼', objects: PANDAS_OBJECTS },
  numpy: { label: 'NumPy', icon: '🔢', objects: NUMPY_OBJECTS },
  express: { label: 'Express', icon: '🚂', objects: EXPRESS_OBJECTS },
};

// libraryKeyがLIBRARY_GROUPSに定義されている場合だけ、コード全体からその具体的なAPI使用を数える
function detectLibraryObjects(libraryKey, code) {
  const group = LIBRARY_GROUPS[libraryKey];
  if (!group) return [];
  const results = [];
  for (const obj of group.objects) {
    const matches = code.match(obj.pattern);
    if (matches && matches.length > 0) results.push({ key: obj.key, count: matches.length });
  }
  return results;
}

module.exports = { LIBRARY_GROUPS, detectLibraryObjects };
