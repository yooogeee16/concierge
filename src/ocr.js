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

const LINE_X_SLACK = 4; // 行の始点/終点付近の単語を拾いこぼさないための許容誤差(ピクセル)

// yがどの行に最も近い(または含まれる)かを返す
function findLineIndex(lines, y) {
  let best = 0;
  let bestDist = Infinity;
  lines.forEach((line, i) => {
    const inside = y >= line.bbox.y0 && y <= line.bbox.y1;
    const dist = inside ? 0 : Math.min(Math.abs(y - line.bbox.y0), Math.abs(y - line.bbox.y1));
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

// ユーザーがマーカーでドラッグ指定した始点/終点をもとに、テキストエディタの範囲選択と
// 同じ感覚で単語を拾う。単一行内なら始点〜終点のx範囲、複数行にまたがる場合は
// 開始行は始点から行末まで・終了行は行頭から終点まで・その間の行は全体を選択する
// (単純な矩形との重なりだけで判定すると、行またぎの選択語句を正しく拾えないため)。
async function recognizeFlowRegion(buffer, dragStart, dragEnd) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);

  const lines = (data.lines || [])
    .map((line) => ({ bbox: line.bbox, words: (line.words || []).filter((w) => w.text && w.text.trim()) }))
    .filter((line) => line.words.length > 0)
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);
  if (lines.length === 0) return null;

  const [topPoint, bottomPoint] = dragStart.y <= dragEnd.y ? [dragStart, dragEnd] : [dragEnd, dragStart];
  const startIdx = findLineIndex(lines, topPoint.y);
  const endIdx = Math.max(startIdx, findLineIndex(lines, bottomPoint.y));

  const kept = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const sorted = [...lines[i].words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (startIdx === endIdx) {
      const xMin = Math.min(topPoint.x, bottomPoint.x) - LINE_X_SLACK;
      const xMax = Math.max(topPoint.x, bottomPoint.x) + LINE_X_SLACK;
      for (const w of sorted) {
        const center = (w.bbox.x0 + w.bbox.x1) / 2;
        if (center >= xMin && center <= xMax) kept.push(w);
      }
    } else if (i === startIdx) {
      for (const w of sorted) {
        const center = (w.bbox.x0 + w.bbox.x1) / 2;
        if (center >= topPoint.x - LINE_X_SLACK) kept.push(w);
      }
    } else if (i === endIdx) {
      for (const w of sorted) {
        const center = (w.bbox.x0 + w.bbox.x1) / 2;
        if (center <= bottomPoint.x + LINE_X_SLACK) kept.push(w);
      }
    } else {
      kept.push(...sorted);
    }
  }
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

module.exports = { recognizeNear, recognizeFlowRegion, terminate };
