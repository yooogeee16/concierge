const { desktopCapturer, screen } = require('electron');

const CROP_W = 480;
const CROP_H = 140;
const REGION_PADDING_Y = 10; // ドラッグ範囲の上下で文字が切れないための余白(物理ピクセル)
const FLOW_PAD_X = 400; // 行またぎ選択(改行をまたぐ範囲選択)に備え、左右に大きめの余白を持たせる(物理ピクセル)

// 指定した地点を含むディスプレイのスクリーンショット(NativeImage)を取得する。
// 現状は単一ディスプレイ(その地点があるディスプレイ)を前提にしている。
async function getDisplaySnapshot(point) {
  const display = screen.getDisplayNearestPoint(point);
  const scale = display.scaleFactor || 1;
  const physW = Math.round(display.size.width * scale);
  const physH = Math.round(display.size.height * scale);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: physW, height: physH },
  });
  if (sources.length === 0) return null;

  let source = sources.find((s) => s.display_id === String(display.id));
  if (!source) source = sources[0];

  const img = source.thumbnail;
  const size = img.getSize();
  if (size.width === 0 || size.height === 0) return null;

  return { display, img, size };
}

async function captureAroundPoint(point) {
  const snap = await getDisplaySnapshot(point);
  if (!snap) return null;
  const { display, img, size } = snap;

  // サムネイルが要求サイズ通りに返らない場合(レターボックス等)に備え、比率で換算する
  const localX = (point.x - display.bounds.x) * (size.width / display.size.width);
  const localY = (point.y - display.bounds.y) * (size.height / display.size.height);

  const cropW = Math.min(CROP_W, size.width);
  const cropH = Math.min(CROP_H, size.height);
  let x = Math.round(localX - cropW / 2);
  let y = Math.round(localY - cropH / 2);
  x = Math.max(0, Math.min(size.width - cropW, x));
  y = Math.max(0, Math.min(size.height - cropH, y));

  const cropped = img.crop({ x, y, width: cropW, height: cropH });
  return { buffer: cropped.toPNG(), cx: localX - x, cy: localY - y };
}

// ユーザーがマーカーでドラッグ指定した始点/終点(スクリーン座標)から、文字が
// 途中で切れないよう左右に大きめの余白を付けて切り出す(行の途中から始まる/
// 終わる「行またぎ」の選択でも、行全体を拾えるようにするため)。
// OCR側で行ごとの流れとして絞り込めるよう、始点/終点を切り出した画像内での
// 座標(dragStart/dragEnd)に変換して一緒に返す。
async function captureRegion(p0, p1) {
  const centerPoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const snap = await getDisplaySnapshot(centerPoint);
  if (!snap) return null;
  const { display, img, size } = snap;

  const scaleX = size.width / display.size.width;
  const scaleY = size.height / display.size.height;
  const toLocal = (p) => ({ x: (p.x - display.bounds.x) * scaleX, y: (p.y - display.bounds.y) * scaleY });

  const d0 = toLocal(p0);
  const d1 = toLocal(p1);
  const selX = Math.min(d0.x, d1.x);
  const selY = Math.min(d0.y, d1.y);
  const selW = Math.abs(d1.x - d0.x);
  const selH = Math.abs(d1.y - d0.y);

  let cropX = Math.round(selX - FLOW_PAD_X);
  let cropY = Math.round(selY - REGION_PADDING_Y);
  let cropW = Math.round(selW) + FLOW_PAD_X * 2;
  let cropH = Math.round(selH) + REGION_PADDING_Y * 2;

  cropX = Math.max(0, Math.min(size.width - 1, cropX));
  cropY = Math.max(0, Math.min(size.height - 1, cropY));
  cropW = Math.max(1, Math.min(size.width - cropX, cropW));
  cropH = Math.max(1, Math.min(size.height - cropY, cropH));

  const cropped = img.crop({ x: cropX, y: cropY, width: cropW, height: cropH });

  return {
    buffer: cropped.toPNG(),
    dragStart: { x: d0.x - cropX, y: d0.y - cropY },
    dragEnd: { x: d1.x - cropX, y: d1.y - cropY },
  };
}

module.exports = { captureAroundPoint, captureRegion };
