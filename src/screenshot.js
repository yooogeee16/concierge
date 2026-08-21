const { desktopCapturer, screen } = require('electron');

const CROP_W = 480;
const CROP_H = 140;
const REGION_PADDING = 6; // ドラッグ範囲の端で文字が切れないための余白(物理ピクセル)

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

// ユーザーがマーカーでドラッグ指定した矩形(スクリーン座標)をそのまま切り出す
async function captureRegion(rect) {
  const centerPoint = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const snap = await getDisplaySnapshot(centerPoint);
  if (!snap) return null;
  const { display, img, size } = snap;

  const scaleX = size.width / display.size.width;
  const scaleY = size.height / display.size.height;

  let x = Math.round((rect.x - display.bounds.x) * scaleX) - REGION_PADDING;
  let y = Math.round((rect.y - display.bounds.y) * scaleY) - REGION_PADDING;
  let w = Math.round(rect.width * scaleX) + REGION_PADDING * 2;
  let h = Math.round(rect.height * scaleY) + REGION_PADDING * 2;

  x = Math.max(0, Math.min(size.width - 1, x));
  y = Math.max(0, Math.min(size.height - 1, y));
  w = Math.max(1, Math.min(size.width - x, w));
  h = Math.max(1, Math.min(size.height - y, h));

  const cropped = img.crop({ x, y, width: w, height: h });
  return { buffer: cropped.toPNG() };
}

module.exports = { captureAroundPoint, captureRegion };
