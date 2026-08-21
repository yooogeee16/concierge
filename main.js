const { app, BrowserWindow, ipcMain, Menu, Tray, screen, globalShortcut, shell } = require('electron');
const path = require('path');

const store = require('./src/store');
const dictionary = require('./src/dictionary');
const { PERSONAS, getPersona } = require('./src/personas');
const screenshot = require('./src/screenshot');
const ocr = require('./src/ocr');
const gemini = require('./src/gemini');
const sysinfo = require('./src/sysinfo');

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
const DRIFT_SPEED_PX_PER_SEC = 16;
const IDLE_DURATION_MS = [4000, 9000];
const DRIFT_DURATION_MS = [1000, 2200];
const DRAG_END_DEBOUNCE_MS = 220;

let mascotWindow = null;
let overlayWindow = null;
let popupWindow = null;
let setupWindow = null;
let dictionaryWindow = null;
let tray = null;

let settings = {};
let currentCharacter = 'navy';

let lookupMode = false;
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
      if (lookupMode) exitLookupMode();
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

  if (lookupMode) return; // 調べるモード中はオーバーレイの上に留まらせる

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

function createOverlayWindow() {
  const bounds = getVirtualScreenBounds();
  overlayWindow = new BrowserWindow({
    ...bounds,
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

function enterLookupMode() {
  lookupMode = true;
  hidePopup(); // 前回調べた内容が残っていたら消す
  createOverlayWindow();
  if (mascotWindow) mascotWindow.moveTop();
  sendMascotState({ mode: 'lookup', thinking: false });
  globalShortcut.register('Escape', () => exitLookupMode());
  refreshTrayMenu();
}

// keepPopup: 結果の吹き出しは表示したまま調べるモードだけ終了する場合にtrue
function exitLookupMode({ keepPopup = false } = {}) {
  lookupMode = false;
  busy = false;
  destroyOverlayWindow();
  if (!keepPopup) hidePopup();
  sendMascotState({ mode: 'idle', thinking: false });
  globalShortcut.unregister('Escape');
  refreshTrayMenu();
}

function toggleLookupMode() {
  if (lookupMode) exitLookupMode();
  else enterLookupMode();
}

async function handleLookupClick() {
  if (busy) return;
  busy = true;
  lastResult = null;
  const point = screen.getCursorScreenPoint();
  const persona = getPersona(currentCharacter);
  sendMascotState({ mode: 'lookup', thinking: true });
  showPopup(point, { status: 'loading', persona });

  try {
    const shot = await screenshot.captureAroundPoint(point);
    if (!shot) {
      updatePopup({ status: 'error', error: '画面のキャプチャに失敗しました。', persona });
      return;
    }
    const rec = await ocr.recognizeNear(shot.buffer, shot.cx, shot.cy);
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
      lastResult = { term: rec.term, text: result.text, sources: result.sources };
      updatePopup({ status: 'done', term: rec.term, text: result.text, sources: result.sources, persona });
    }
  } catch (err) {
    updatePopup({ status: 'error', error: err.message || String(err), persona });
  } finally {
    // 1回調べたら調べるモードは自動で終了する(結果の吹き出しは表示したまま)
    exitLookupMode({ keepPopup: true });
  }
}

function setCharacter(key) {
  if (!PERSONAS[key]) return;
  currentCharacter = key;
  settings.character = key;
  store.saveSettings(app, settings);
  sendMascotState({ mode: lookupMode ? 'lookup' : 'idle', thinking: false });
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
  tray.on('click', () => toggleLookupMode());
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    { label: 'コンシェルジュ', enabled: false },
    { type: 'separator' },
    {
      label: lookupMode ? '調べるモードを終了' : '調べるモードを開始',
      click: () => toggleLookupMode(),
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
    {
      label: 'システム情報',
      submenu: sysinfo.getSnapshotLines().map((label) => ({ label, enabled: false })),
    },
    { label: 'APIキーを再設定', click: () => createSetupWindow(true) },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
}

function startMainApp() {
  if (mascotWindow) return;
  createMascotWindow();
  createPopupWindow();
  startWanderTimer();
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
});

app.on('before-quit', () => {
  ocr.terminate().catch(() => {});
});

ipcMain.on('mascot:toggle-lookup', () => toggleLookupMode());
ipcMain.on('mascot:context-menu', () => buildContextMenu().popup({ window: mascotWindow }));

ipcMain.on('lookup:click', () => handleLookupClick());
ipcMain.on('lookup:cancel', () => exitLookupMode());

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
  enterLookupMode();
});

ipcMain.handle('popup:save-dictionary', () => {
  if (!lastResult) return { ok: false };
  const record = dictionary.saveEntry(app, lastResult);
  return { ok: true, record };
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
