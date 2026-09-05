const { app, BrowserWindow, ipcMain, Menu, Tray, screen, globalShortcut, shell } = require('electron');
const path = require('path');

const store = require('./src/store');
const dictionary = require('./src/dictionary');
const { PERSONAS, getPersona } = require('./src/personas');
const screenshot = require('./src/screenshot');
const ocr = require('./src/ocr');
const gemini = require('./src/gemini');
const sysinfo = require('./src/sysinfo');
const codeAnalyzer = require('./src/codeAnalyzer');
const codedex = require('./src/codedex');
const { getSyntaxEntry, getLibraryEntry } = require('./src/codeCatalog');

// タスクバー等に出るウィンドウ用のアイコン。開発時(npm start)はElectronの
// デフォルトアイコンではなくこちらを明示的に使う(パッケージ版はビルド設定のiconが自動で使われる)。
const APP_ICON_PATH = path.join(__dirname, 'build', 'icon.ico');

// --- レイアウト定数 ---
const MASCOT_DISPLAY_W = 72; // マスコット画像の表示幅(SVGの縦横比 144:204 を維持して高さを決める)
const MASCOT_DISPLAY_H = Math.round((MASCOT_DISPLAY_W * 204) / 144);
const MASCOT_PADDING = 22; // ホバーの光彩や、ドラッグでつまむ余白
const MASCOT_W = MASCOT_DISPLAY_W + MASCOT_PADDING * 2;
const MASCOT_H = MASCOT_DISPLAY_H + MASCOT_PADDING * 2;
const MASCOT_MARGIN = 24;

const POPUP_WIDTH = 320;
const POPUP_MIN_HEIGHT = 70;
const POPUP_MAX_HEIGHT = 420;
const POPUP_OFFSET = 18;

// --- ふわふわ浮遊(自律移動)関連定数。「少しだけ」動く程度に留める ---
const DRIFT_TICK_MS = 60;
const DRIFT_SPEED_PX_PER_SEC = 8;
const IDLE_DURATION_MS = [8000, 20000];
const DRIFT_DURATION_MS = [600, 1200];
const DRAG_END_DEBOUNCE_MS = 220;

// --- 辞書の復習クイズ関連定数。「たまに」聞きに来る程度の頻度に留める ---
const QUIZ_INTERVAL_MS = [60 * 1000, 60 * 1000]; // 1分に1回

let mascotWindow = null;
let overlayWindow = null;
let popupWindow = null;
let setupWindow = null;
let dictionaryWindow = null;
let codeWindow = null;
let codedexWindow = null;
let detailWindow = null;
let quizWindow = null;
let quizTimer = null;
let tray = null;

let settings = {};
let currentCharacter = 'navy';

let activeMode = null; // null(アイドル) | 'lookup'(調べるモード) | 'detail'(詳しく解説モード)
let busy = false;
let lastClickPoint = null;
let lastResult = null; // 直近の調べた結果({term, text, sources})。辞書登録に使う

let lastCommandedBounds = null;
let wanderIntervalId = null;
const wander = {
  x: 0,
  y: 0,
  direction: 1,
  mode: 'idle', // 'idle' | 'drift'
  modeUntil: 0,
  dragging: false,
  lastMoveEventAt: 0,
  lastSentFacing: null,
  lastSentWalking: null,
};

function randRange([min, max]) {
  return min + Math.random() * (max - min);
}

function sendMascotState(partial) {
  if (!mascotWindow || mascotWindow.isDestroyed()) return;
  mascotWindow.webContents.send('mascot:state', { character: currentCharacter, ...partial });
}

function sendMascotWalk(data) {
  if (!mascotWindow || mascotWindow.isDestroyed()) return;
  mascotWindow.webContents.send('mascot:walk', data);
}

function moveMascotTo(x, y) {
  if (!mascotWindow || mascotWindow.isDestroyed()) return;
  lastCommandedBounds = { x: Math.round(x), y: Math.round(y) };
  mascotWindow.setBounds({ x: lastCommandedBounds.x, y: lastCommandedBounds.y, width: MASCOT_W, height: MASCOT_H });
}

function createMascotWindow() {
  const display = screen.getPrimaryDisplay();
  const { x: wx, y: wy, width: wW, height: wH } = display.workArea;

  mascotWindow = new BrowserWindow({
    width: MASCOT_W,
    height: MASCOT_H,
    x: wx + wW - MASCOT_W - MASCOT_MARGIN,
    y: wy + wH - MASCOT_H - MASCOT_MARGIN,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-mascot.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mascotWindow.setAlwaysOnTop(true, 'screen-saver');
  mascotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mascotWindow.loadFile(path.join(__dirname, 'renderer', 'mascot', 'index.html'));

  const [initialX, initialY] = mascotWindow.getPosition();
  wander.x = initialX;
  wander.y = initialY;

  // ドラッグは-webkit-app-region:drag によるOSネイティブ移動に任せている。
  // 自分でsetBoundsした直後の座標と一致しなければユーザーによるドラッグとみなす。
  mascotWindow.on('move', () => {
    if (!mascotWindow) return;
    const [x, y] = mascotWindow.getPosition();
    const matchesCommand =
      lastCommandedBounds && Math.abs(x - lastCommandedBounds.x) <= 1 && Math.abs(y - lastCommandedBounds.y) <= 1;
    if (!matchesCommand) {
      if (activeMode !== null) exitMode();
      wander.x = x;
      wander.y = y;
      wander.dragging = true;
      wander.lastMoveEventAt = Date.now();
    }
  });

  mascotWindow.on('system-context-menu', (event) => {
    event.preventDefault();
    buildContextMenu().popup({ window: mascotWindow });
  });

  mascotWindow.on('closed', () => {
    mascotWindow = null;
    app.quit();
  });
}

function wanderTick() {
  if (!mascotWindow || mascotWindow.isDestroyed()) return;
  const now = Date.now();

  if (wander.dragging) {
    if (now - wander.lastMoveEventAt > DRAG_END_DEBOUNCE_MS) {
      wander.dragging = false;
      wander.mode = 'idle';
      wander.modeUntil = now + randRange(IDLE_DURATION_MS);
    }
    return;
  }

  if (activeMode !== null) return; // 調べるモード/詳しく解説モード中はオーバーレイの上に留まらせる

  const display = screen.getDisplayNearestPoint({
    x: Math.round(wander.x + MASCOT_W / 2),
    y: Math.round(wander.y + MASCOT_H / 2),
  });
  const work = display.workArea;
  const minX = work.x;
  const maxX = work.x + work.width - MASCOT_W;

  if (now >= wander.modeUntil) {
    if (wander.mode === 'drift') {
      wander.mode = 'idle';
      wander.modeUntil = now + randRange(IDLE_DURATION_MS);
    } else {
      wander.mode = 'drift';
      if (Math.random() < 0.5) wander.direction *= -1;
      wander.modeUntil = now + randRange(DRIFT_DURATION_MS);
    }
  }

  let walking = false;
  if (wander.mode === 'drift') {
    walking = true;
    const dx = ((DRIFT_SPEED_PX_PER_SEC * DRIFT_TICK_MS) / 1000) * wander.direction;
    wander.x += dx;
    if (wander.x <= minX) {
      wander.x = minX;
      wander.direction = 1;
    } else if (wander.x >= maxX) {
      wander.x = maxX;
      wander.direction = -1;
    }
    moveMascotTo(wander.x, wander.y);
  }

  const facing = wander.direction >= 0 ? 'right' : 'left';
  if (walking !== wander.lastSentWalking || facing !== wander.lastSentFacing) {
    wander.lastSentWalking = walking;
    wander.lastSentFacing = facing;
    sendMascotWalk({ walking, facing });
  }
}

function startWanderTimer() {
  stopWanderTimer();
  wanderIntervalId = setInterval(wanderTick, DRIFT_TICK_MS);
}

function stopWanderTimer() {
  if (wanderIntervalId) clearInterval(wanderIntervalId);
  wanderIntervalId = null;
}

function getVirtualScreenBounds() {
  const displays = screen.getAllDisplays();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x);
    minY = Math.min(minY, d.bounds.y);
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width);
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

let overlayBounds = null;

function createOverlayWindow() {
  overlayBounds = getVirtualScreenBounds();
  overlayWindow = new BrowserWindow({
    ...overlayBounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-overlay.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay', 'index.html'));
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function destroyOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  overlayWindow = null;
}

function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_MIN_HEIGHT,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-popup.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  popupWindow.setAlwaysOnTop(true, 'screen-saver');
  popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  popupWindow.loadFile(path.join(__dirname, 'renderer', 'popup', 'index.html'));
}

function positionPopup(point, width, height) {
  const display = screen.getDisplayNearestPoint(point);
  const work = display.workArea;

  let x = point.x + POPUP_OFFSET;
  let y = point.y + POPUP_OFFSET;

  if (x + width > work.x + work.width) x = point.x - POPUP_OFFSET - width;
  if (y + height > work.y + work.height) y = point.y - POPUP_OFFSET - height;

  x = Math.max(work.x, Math.min(work.x + work.width - width, x));
  y = Math.max(work.y, Math.min(work.y + work.height - height, y));

  return { x: Math.round(x), y: Math.round(y) };
}

function showPopup(point, data) {
  if (!popupWindow || popupWindow.isDestroyed()) createPopupWindow();
  lastClickPoint = point;
  const { x, y } = positionPopup(point, POPUP_WIDTH, POPUP_MIN_HEIGHT);
  popupWindow.setBounds({ x, y, width: POPUP_WIDTH, height: POPUP_MIN_HEIGHT });
  popupWindow.webContents.send('popup:update', data);
  popupWindow.showInactive();
}

function updatePopup(data) {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  popupWindow.webContents.send('popup:update', data);
}

function hidePopup() {
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.hide();
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(buildContextMenu());
}

// mode: 'lookup' | 'detail'。既にどちらかのモードが有効な場合は、オーバーレイ等は
// 維持したままモードの切り替えだけを行う(調べる→詳しく解説、のクリック遷移のため)。
function enterMode(mode) {
  const wasActive = activeMode !== null;
  activeMode = mode;
  if (!wasActive) {
    hidePopup(); // 前回調べた内容が残っていたら消す
    createOverlayWindow();
    if (mascotWindow) mascotWindow.moveTop();
    globalShortcut.register('Escape', () => exitMode());
  }
  sendMascotState({ mode, thinking: false });
  refreshTrayMenu();
}

// keepPopup: 結果の吹き出しは表示したままモードだけ終了する場合にtrue
function exitMode({ keepPopup = false } = {}) {
  activeMode = null;
  busy = false;
  destroyOverlayWindow();
  if (!keepPopup) hidePopup();
  sendMascotState({ mode: 'idle', thinking: false });
  globalShortcut.unregister('Escape');
  refreshTrayMenu();
}

// マスコットをクリックするたびに idle → 調べるモード → 詳しく解説モード → idle と巡回する
function cycleMode() {
  if (activeMode === null) enterMode('lookup');
  else if (activeMode === 'lookup') enterMode('detail');
  else exitMode();
}

const DRAG_THRESHOLD_PX = 6; // これ未満の移動は「クリック」として扱う(単語スナップ検出)

// overlayのローカル座標を、ディスプレイ間の位置ずれを考慮したスクリーン座標に変換する
function localPointToScreen(x, y) {
  const ox = overlayBounds ? overlayBounds.x : 0;
  const oy = overlayBounds ? overlayBounds.y : 0;
  return { x: x + ox, y: y + oy };
}

async function handleLookupSelect(localRect) {
  if (busy) return;
  busy = true;
  lastResult = null;

  const p0 = localPointToScreen(localRect.x0, localRect.y0);
  const p1 = localPointToScreen(localRect.x1, localRect.y1);
  const width = Math.abs(p1.x - p0.x);
  const height = Math.abs(p1.y - p0.y);
  const isDrag = width > DRAG_THRESHOLD_PX || height > DRAG_THRESHOLD_PX;
  const anchorPoint = { x: Math.round((p0.x + p1.x) / 2), y: Math.round((p0.y + p1.y) / 2) };

  const persona = getPersona(currentCharacter);
  sendMascotState({ mode: 'lookup', thinking: true });

  try {
    // 「調べています」ポップアップを表示するより前にキャプチャを済ませる。
    // 先にポップアップを出してしまうと、行またぎ選択のために左右へ大きく
    // 広げたキャプチャ範囲にポップアップ自体が写り込んでしまうため。
    let rec;
    let shot;
    if (isDrag) {
      // マーカーでドラッグした始点〜終点を、テキストの流れとしてOCRする
      // (行をまたぐ選択でも正しく拾えるよう、単純な矩形との重なり判定は使わない)
      shot = await screenshot.captureRegion(p0, p1);
      if (!shot) {
        showPopup(anchorPoint, { status: 'error', error: '画面のキャプチャに失敗しました。', persona });
        return;
      }
      rec = await ocr.recognizeFlowRegion(shot.buffer, shot.dragStart, shot.dragEnd);
    } else {
      // 単純なクリックの場合は、これまで通りクリック位置に最も近い単語を拾う
      shot = await screenshot.captureAroundPoint(anchorPoint);
      if (!shot) {
        showPopup(anchorPoint, { status: 'error', error: '画面のキャプチャに失敗しました。', persona });
        return;
      }
      rec = await ocr.recognizeNear(shot.buffer, shot.cx, shot.cy);
    }

    showPopup(anchorPoint, { status: 'loading', persona });

    if (!rec) {
      updatePopup({ status: 'empty', persona });
      return;
    }
    updatePopup({ status: 'loading', term: rec.term, persona });

    const result = await gemini.explainTerm({
      term: rec.term,
      contextLine: rec.contextLine,
      apiKey: settings.apiKey,
      model: settings.model,
      tone: persona.tone,
    });
    if (!result.ok) {
      updatePopup({ status: 'error', term: rec.term, error: result.error, persona });
    } else {
      // 表示・辞書登録には、OCRの生の検出結果ではなく、AIが誤字等を補正した語句を使う
      const displayTerm = result.term || rec.term;
      lastResult = { term: displayTerm, text: result.text, sources: result.sources };
      dictionary.saveEntry(app, lastResult); // 辞書には既定で登録し、不要なら吹き出しの取り消しボタンで消す
      updatePopup({ status: 'done', term: displayTerm, text: result.text, sources: result.sources, persona });
    }
  } catch (err) {
    updatePopup({ status: 'error', error: err.message || String(err), persona });
  } finally {
    // 1回調べたら調べるモードは自動で終了する(結果の吹き出しは表示したまま)
    exitMode({ keepPopup: true });
  }
}

const DETAIL_MAX_CHARS = 4000; // 詳しく解説モードでGeminiに渡す文章量の上限

// 詳しく解説モード: ドラッグで指定した範囲の文章をまとめて渡し、専用ウィンドウに
// 見出し・箇条書きつきの解説ノート(Markdown)を表示する。単純なクリックには反応しない。
async function handleDetailSelect(localRect) {
  if (busy) return;
  busy = true;

  const p0 = localPointToScreen(localRect.x0, localRect.y0);
  const p1 = localPointToScreen(localRect.x1, localRect.y1);
  const width = Math.abs(p1.x - p0.x);
  const height = Math.abs(p1.y - p0.y);

  if (width <= DRAG_THRESHOLD_PX && height <= DRAG_THRESHOLD_PX) {
    // ドラッグで範囲を選ぶ専用のモードなので、ただのクリックは無視する
    busy = false;
    return;
  }

  const persona = getPersona(currentCharacter);
  sendMascotState({ mode: 'detail', thinking: true });

  try {
    // 新しいウィンドウを開く前にキャプチャを済ませる(既定位置が選択範囲と
    // 重なって写り込むのを避けるため)。
    const shot = await screenshot.captureRegion(p0, p1);
    if (!shot) {
      openDetailWindow();
      updateDetail({ status: 'error', error: '画面のキャプチャに失敗しました。', persona });
      return;
    }
    const rec = await ocr.recognizeFlowRegion(shot.buffer, shot.dragStart, shot.dragEnd);
    openDetailWindow();
    if (!rec || !rec.fullText) {
      updateDetail({ status: 'empty', persona });
      return;
    }

    const result = await gemini.explainDetailed({
      text: rec.fullText.slice(0, DETAIL_MAX_CHARS),
      apiKey: settings.apiKey,
      model: settings.model,
      tone: persona.tone,
    });
    if (!result.ok) {
      updateDetail({ status: 'error', error: result.error, persona });
    } else {
      // 抽出した語句は既定で辞書に登録し、不要なものだけウィンドウ側で個別に取り消せるようにする
      for (const t of result.terms || []) {
        dictionary.saveEntry(app, { term: t.term, text: t.text, sources: [] });
      }
      updateDetail({ status: 'done', markdown: result.markdown, terms: result.terms || [], persona });
    }
  } catch (err) {
    updateDetail({ status: 'error', error: err.message || String(err), persona });
  } finally {
    exitMode();
  }
}

function setCharacter(key) {
  if (!PERSONAS[key]) return;
  currentCharacter = key;
  settings.character = key;
  store.saveSettings(app, settings);
  sendMascotState({ mode: activeMode || 'idle', thinking: false });
  refreshTrayMenu();
  if (tray && !tray.isDestroyed()) tray.setImage(trayIconPath(currentCharacter));
}

function openDictionaryWindow() {
  if (dictionaryWindow && !dictionaryWindow.isDestroyed()) {
    dictionaryWindow.focus();
    return;
  }
  dictionaryWindow = new BrowserWindow({
    width: 420,
    height: 560,
    title: 'コンシェルジュ 辞書',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-dictionary.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  dictionaryWindow.loadFile(path.join(__dirname, 'renderer', 'dictionary', 'index.html'));
  dictionaryWindow.on('closed', () => {
    dictionaryWindow = null;
  });
}

function openCodeWindow() {
  if (codeWindow && !codeWindow.isDestroyed()) {
    codeWindow.focus();
    return;
  }
  codeWindow = new BrowserWindow({
    width: 760,
    height: 680,
    title: 'コード解説',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-code.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  codeWindow.loadFile(path.join(__dirname, 'renderer', 'code', 'index.html'));
  codeWindow.on('closed', () => {
    codeWindow = null;
  });
}

function openDetailWindow() {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.focus();
    return;
  }
  detailWindow = new BrowserWindow({
    width: 720,
    height: 780,
    title: '詳しく解説',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-detail.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  detailWindow.loadFile(path.join(__dirname, 'renderer', 'detail', 'index.html'));
  detailWindow.on('closed', () => {
    detailWindow = null;
  });
}

function updateDetail(data) {
  if (!detailWindow || detailWindow.isDestroyed()) return;
  detailWindow.webContents.send('detail:update', data);
}

function openCodedexWindow() {
  if (codedexWindow && !codedexWindow.isDestroyed()) {
    codedexWindow.focus();
    return;
  }
  codedexWindow = new BrowserWindow({
    width: 780,
    height: 600,
    title: 'コード図鑑',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-codedex.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  codedexWindow.loadFile(path.join(__dirname, 'renderer', 'codedex', 'index.html'));
  codedexWindow.on('closed', () => {
    codedexWindow = null;
  });
}

function createSetupWindow(prefill) {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width: 460,
    height: 430,
    resizable: false,
    title: 'コンシェルジュ 初期設定',
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-setup.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.loadFile(path.join(__dirname, 'renderer', 'setup', 'index.html'));
  if (prefill && settings.apiKey) {
    setupWindow.webContents.on('did-finish-load', () => {
      if (setupWindow) setupWindow.webContents.send('setup:prefill', settings.apiKey);
    });
  }
  setupWindow.on('closed', () => {
    setupWindow = null;
    // タイトルバーの×で閉じた場合も、まだ起動していなければ起動する(後からいつでもAPIキーは設定可能)
    if (!mascotWindow) startMainApp();
  });
}

function trayIconPath(character) {
  return path.join(__dirname, 'renderer', 'assets', `tray-${character}.png`);
}

function createTray() {
  tray = new Tray(trayIconPath(currentCharacter));
  tray.setToolTip('コンシェルジュ');
  tray.setContextMenu(buildContextMenu());
  tray.on('click', () => cycleMode());
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    { label: 'コンシェルジュ', enabled: false },
    { type: 'separator' },
    {
      label:
        activeMode === null
          ? '調べるモードを開始'
          : activeMode === 'lookup'
            ? '詳しく解説モードに切り替え'
            : 'モードを終了',
      click: () => cycleMode(),
    },
    {
      label: '見た目を変える',
      submenu: Object.values(PERSONAS).map((p) => ({
        label: p.label,
        type: 'radio',
        checked: currentCharacter === p.key,
        click: () => setCharacter(p.key),
      })),
    },
    { label: '辞書を見る', click: () => openDictionaryWindow() },
    { type: 'separator' },
    { label: 'コードを解説する', click: () => openCodeWindow() },
    { label: 'コード図鑑を見る', click: () => openCodedexWindow() },
    { type: 'separator' },
    {
      label: 'システム情報',
      submenu: sysinfo.getSnapshotLines().map((label) => ({ label, enabled: false })),
    },
    { label: 'APIキーを再設定', click: () => createSetupWindow(true) },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
}

const QUIZ_WIDTH = 300;
const QUIZ_MIN_HEIGHT = 130;
const QUIZ_MAX_HEIGHT = 380;

function scheduleNextQuiz() {
  if (quizTimer) clearTimeout(quizTimer);
  quizTimer = setTimeout(maybeShowQuiz, randRange(QUIZ_INTERVAL_MS));
}

// 辞書に登録した語句を、たまにマスコットが思い出したように聞きに来る。
// まだ出題していない語句を優先する。
function maybeShowQuiz() {
  scheduleNextQuiz();
  if (activeMode !== null) return; // 調べる/詳しく解説モード中は聞きに来ない
  if (quizWindow && !quizWindow.isDestroyed()) return; // 既に聞いている最中
  const entries = dictionary.loadDictionary(app);
  if (!entries || entries.length === 0) return;
  const entry = dictionary.pickQuizEntry(entries);
  dictionary.markQuizzed(app, entry.term);
  openQuizWindow(entry);
}

// width/height含め、必ずディスプレイの作業領域(タスクバー等を除いた範囲)に収まるよう
// 厳密にクランプする。マスコットの上、入らなければ下に表示する。
function positionQuizWindow(width, height) {
  const display = screen.getDisplayNearestPoint({ x: wander.x + MASCOT_W / 2, y: wander.y + MASCOT_H / 2 });
  const work = display.workArea;
  const w = Math.min(width, work.width);
  const h = Math.min(height, work.height);

  let x = wander.x + MASCOT_W / 2 - w / 2;
  let y = wander.y - h - 12;
  if (y < work.y) y = wander.y + MASCOT_H + 12; // 上にはみ出す場合はマスコットの下に出す

  x = Math.max(work.x, Math.min(work.x + work.width - w, x));
  y = Math.max(work.y, Math.min(work.y + work.height - h, y));

  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

function openQuizWindow(entry) {
  const persona = getPersona(currentCharacter);
  const { x, y, width, height } = positionQuizWindow(QUIZ_WIDTH, QUIZ_MIN_HEIGHT);

  quizWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-quiz.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  quizWindow.setAlwaysOnTop(true, 'screen-saver');
  quizWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  quizWindow.loadFile(path.join(__dirname, 'renderer', 'quiz', 'index.html'));
  quizWindow.webContents.once('did-finish-load', () => {
    if (quizWindow) quizWindow.webContents.send('quiz:show', { entry, persona });
  });
  quizWindow.once('ready-to-show', () => {
    if (quizWindow) quizWindow.showInactive();
  });
  quizWindow.on('closed', () => {
    quizWindow = null;
  });
}

function closeQuizWindow() {
  if (quizWindow && !quizWindow.isDestroyed()) quizWindow.close();
  quizWindow = null;
}

function startMainApp() {
  if (mascotWindow) return;
  createMascotWindow();
  createPopupWindow();
  startWanderTimer();
  scheduleNextQuiz();
}

app.whenReady().then(() => {
  settings = store.loadSettings(app);
  if (!settings.character || !PERSONAS[settings.character]) settings.character = 'navy';
  currentCharacter = settings.character;

  createTray();
  sysinfo.start();

  if (!settings.apiKey) {
    createSetupWindow();
  } else {
    startMainApp();
  }

  app.on('activate', () => {
    if (!mascotWindow) startMainApp();
  });
});

app.on('window-all-closed', () => {
  // トレイ常駐アプリなので、マスコットのウィンドウが閉じても終了しない
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopWanderTimer();
  sysinfo.stop();
  if (quizTimer) clearTimeout(quizTimer);
});

app.on('before-quit', () => {
  ocr.terminate().catch(() => {});
});

ipcMain.on('mascot:toggle-lookup', () => cycleMode());
ipcMain.on('mascot:context-menu', () => buildContextMenu().popup({ window: mascotWindow }));

ipcMain.on('lookup:select', (_event, rect) => {
  if (activeMode === 'detail') handleDetailSelect(rect);
  else handleLookupSelect(rect);
});
ipcMain.on('lookup:cancel', () => exitMode());

ipcMain.on('popup:content-size', (_event, size) => {
  if (!popupWindow || popupWindow.isDestroyed() || !lastClickPoint) return;
  const height = Math.max(POPUP_MIN_HEIGHT, Math.min(POPUP_MAX_HEIGHT, Math.ceil(size.height)));
  const { x, y } = positionPopup(lastClickPoint, POPUP_WIDTH, height);
  popupWindow.setBounds({ x, y, width: POPUP_WIDTH, height });
});

ipcMain.on('popup:open-link', (_event, uri) => {
  if (typeof uri === 'string' && /^https?:\/\//.test(uri)) shell.openExternal(uri);
});

ipcMain.on('popup:close', () => hidePopup());

// 選んだ文字が間違っていた場合、もう一度クリックし直せるように調べるモードへ戻す
ipcMain.on('popup:retry', () => {
  hidePopup();
  enterMode('lookup');
});

ipcMain.handle('popup:remove-dictionary', () => {
  if (!lastResult) return { ok: false };
  dictionary.deleteEntry(app, lastResult.term);
  return { ok: true };
});

ipcMain.on('quiz:content-size', (_event, size) => {
  if (!quizWindow || quizWindow.isDestroyed()) return;
  const requested = Math.max(QUIZ_MIN_HEIGHT, Math.min(QUIZ_MAX_HEIGHT, Math.ceil(size.height)));
  const { x, y, width, height } = positionQuizWindow(QUIZ_WIDTH, requested);
  quizWindow.setBounds({ x, y, width, height });
});

ipcMain.on('quiz:open-link', (_event, uri) => {
  if (typeof uri === 'string' && /^https?:\/\//.test(uri)) shell.openExternal(uri);
});

ipcMain.on('quiz:close', () => closeQuizWindow());

ipcMain.on('quiz:respond', (_event, { term, response }) => {
  if (typeof term === 'string' && term) dictionary.markResponse(app, term, response);
});

ipcMain.handle('detail:remove-dictionary', (_event, term) => {
  if (typeof term !== 'string' || !term) return { ok: false };
  dictionary.deleteEntry(app, term);
  return { ok: true };
});

ipcMain.handle('dictionary:list', () => dictionary.loadDictionary(app));
ipcMain.handle('dictionary:delete', (_event, term) => dictionary.deleteEntry(app, term));
ipcMain.on('dictionary:open-link', (_event, uri) => {
  if (typeof uri === 'string' && /^https?:\/\//.test(uri)) shell.openExternal(uri);
});

ipcMain.on('setup:save', (_event, apiKey) => {
  settings.apiKey = String(apiKey || '').trim();
  store.saveSettings(app, settings);
  if (setupWindow) setupWindow.close();
  startMainApp();
});

ipcMain.on('setup:skip', () => {
  if (setupWindow) setupWindow.close();
  startMainApp();
});

ipcMain.on('setup:open-link', (_event, uri) => {
  if (typeof uri === 'string' && /^https?:\/\//.test(uri)) shell.openExternal(uri);
});

ipcMain.handle('code:analyze', async (_event, { filename, content }) => {
  if (typeof content !== 'string' || !content.trim()) {
    return { ok: false, error: '空のファイルは解析できません。' };
  }

  const analysis = codeAnalyzer.analyzeCode(filename, content);
  if (analysis.languageId === 'unknown') {
    return { ok: false, error: '対応していないファイル形式です(JavaScript / TypeScript / Python / C / C++ / C#に対応しています)。' };
  }

  codedex.recordEncounters(app, analysis);

  const syntax = analysis.syntax
    .map(({ key, count }) => {
      const entry = getSyntaxEntry(key);
      return entry ? { key, count, label: entry.label, icon: entry.icon, description: entry.description } : null;
    })
    .filter(Boolean);
  const libraries = analysis.libraries
    .map(({ key, count }) => {
      const entry = getLibraryEntry(key);
      return entry ? { key, count, label: entry.label, icon: entry.icon, description: entry.description } : null;
    })
    .filter(Boolean);
  const unknownLibraries = analysis.unknownLibraries.map(({ name, count }) => ({
    key: `unknown:${name}`,
    count,
    label: name,
    icon: '❓',
    description: '図鑑にはまだ登録されていないライブラリ/パッケージです。',
  }));

  const persona = getPersona(currentCharacter);
  const explanation = await gemini.explainCode({
    languageLabel: analysis.languageLabel,
    libraryLabels: libraries.map((l) => l.label),
    namedItems: analysis.namedItems,
    codeExcerpt: analysis.codeExcerpt,
    truncated: analysis.truncated,
    apiKey: settings.apiKey,
    model: settings.model,
    tone: persona.tone,
  });

  return {
    ok: true,
    language: { id: analysis.languageId, label: analysis.languageLabel },
    truncated: analysis.truncated,
    codeExcerpt: analysis.codeExcerpt,
    namedItems: analysis.namedItems,
    syntax,
    libraries,
    unknownLibraries,
    explanation,
  };
});

ipcMain.handle('codedex:list', () => codedex.getDexEntries(app));
