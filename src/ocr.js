const path = require('path');
const { createWorker } = require('tesseract.js');
const { app } = require('electron');

const NEAR_THRESHOLD_PX = 90; // クリック位置からこれ以上離れた単語は無関係とみなす
const MAX_REGION_TERM_LENGTH = 60; // ドラッグ範囲から拾う語句の上限文字数(暴走防止)

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['eng', 'jpn'], undefined, {
      cachePath: path.join(app.getPath('userData'), 'tesseract-cache'),
    });
  }
  return workerPromise;
}

// バッファ内の(cx, cy)に最も近い単語と、その単語が属する行のテキストを返す
async function recognizeNear(buffer, cx, cy) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  const words = (data.words || []).filter((w) => w.text && w.text.trim());
  if (words.length === 0) return null;

  let best = null;
  let bestDist = Infinity;
  for (const w of words) {
    const { x0, y0, x1, y1 } = w.bbox;
    const inside = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    const dist = inside ? 0 : Math.hypot((x0 + x1) / 2 - cx, (y0 + y1) / 2 - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = w;
    }
  }
  if (!best || bestDist > NEAR_THRESHOLD_PX) return null;

  return {
    term: best.text.trim(),
    contextLine: ((best.line && best.line.text) || best.text).trim(),
  };
}

// 日本語はTesseractが単語間に余計な空白を挟むことがあるため詰め、
// 英数字混じりの場合は単語区切りとして空白を残す(全角/半角混在の簡易判定)。
function cleanRegionText(raw) {
  const text = (raw || '').trim();
  if (!text) return '';
  const hasLatin = /[A-Za-z]/.test(text);
  const collapsed = hasLatin ? text.replace(/\s+/g, ' ') : text.replace(/\s+/g, '');
  return collapsed.trim();
}

// ユーザーがマーカーでドラッグ指定した範囲を丸ごとOCRし、
// 単語境界の誤検出(例:「サーバーコンソリデーション」の一部の「ン」だけを拾う)を避ける。
async function recognizeRegion(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  const text = cleanRegionText(data.text);
  if (!text) return null;

  const term = text.slice(0, MAX_REGION_TERM_LENGTH);
  return { term, contextLine: text.slice(0, 200) };
}

async function terminate() {
  if (workerPromise) {
    const w = await workerPromise;
    workerPromise = null;
    await w.terminate();
  }
}

module.exports = { recognizeNear, recognizeRegion, terminate };
