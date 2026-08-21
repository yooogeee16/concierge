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

// 単語のバウンディングボックスのうち、どれだけの割合が指定範囲(sel)と重なっているか
function overlapFraction(bbox, sel) {
  const ox0 = Math.max(bbox.x0, sel.x);
  const oy0 = Math.max(bbox.y0, sel.y);
  const ox1 = Math.min(bbox.x1, sel.x + sel.width);
  const oy1 = Math.min(bbox.y1, sel.y + sel.height);
  const overlapW = Math.max(0, ox1 - ox0);
  const overlapH = Math.max(0, oy1 - oy0);
  const bboxArea = Math.max(1, (bbox.x1 - bbox.x0) * (bbox.y1 - bbox.y0));
  return (overlapW * overlapH) / bboxArea;
}

// 読み順(行→行内の左から右)に並べつつ、英数字混じりの場合だけ単語間に空白を入れる
function joinWordsInReadingOrder(words) {
  const sorted = [...words].sort((a, b) => {
    const lineHeight = Math.max(1, a.bbox.y1 - a.bbox.y0);
    const dy = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(dy) > lineHeight * 0.6) return dy;
    return a.bbox.x0 - b.bbox.x0;
  });
  let out = '';
  for (const w of sorted) {
    const t = (w.text || '').trim();
    if (!t) continue;
    if (out) {
      const boundary = /[A-Za-z0-9]/.test(out.slice(-1)) || /[A-Za-z0-9]/.test(t[0]);
      if (boundary) out += ' ';
    }
    out += t;
  }
  return out.trim();
}

const OVERLAP_THRESHOLD = 0.5; // 単語のバウンディングボックスの半分以上が範囲内にあれば採用する

// ユーザーがマーカーでドラッグ指定した範囲を丸ごとOCRし、その中で単語境界の
// 誤検出(例:「サーバーコンソリデーション」の一部の「ン」だけを拾う)を避けつつ、
// 指定範囲の外側にはみ出しただけの単語(例:隣接する別のテキストが余白に写り込んだもの)は除外する。
async function recognizeRegion(buffer, selection) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  const words = (data.words || []).filter((w) => w.text && w.text.trim());
  if (words.length === 0) return null;

  const kept = selection ? words.filter((w) => overlapFraction(w.bbox, selection) >= OVERLAP_THRESHOLD) : words;
  if (kept.length === 0) return null;

  const text = joinWordsInReadingOrder(kept);
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
