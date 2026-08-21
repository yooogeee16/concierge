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

// ユーザーがマーカーでドラッグ指定した矩形(スクリーン座標)を、文字が切れないよう
// 少し余白を付けて切り出す。OCR結果を「指定範囲内」だけに絞り込めるよう、
// 切り出した画像内での指定範囲自体の座標(selection)も一緒に返す。
async function captureRegion(rect) {
  const centerPoint = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const snap = await getDisplaySnapshot(centerPoint);
  if (!snap) return null;
  const { display, img, size } = snap;

  const scaleX = size.width / display.size.width;
  const scaleY = size.height / display.size.height;

  const selX = (rect.x - display.bounds.x) * scaleX;
  const selY = (rect.y - display.bounds.y) * scaleY;
  const selW = rect.width * scaleX;
  const selH = rect.height * scaleY;

  let cropX = Math.round(selX - REGION_PADDING);
  let cropY = Math.round(selY - REGION_PADDING);
  let cropW = Math.round(selW) + REGION_PADDING * 2;
  let cropH = Math.round(selH) + REGION_PADDING * 2;

  cropX = Math.max(0, Math.min(size.width - 1, cropX));
  cropY = Math.max(0, Math.min(size.height - 1, cropY));
  cropW = Math.max(1, Math.min(size.width - cropX, cropW));
  cropH = Math.max(1, Math.min(size.height - cropY, cropH));

  const cropped = img.crop({ x: cropX, y: cropY, width: cropW, height: cropH });

  const selection = {
    x: selX - cropX,
    y: selY - cropY,
    width: selW,
    height: selH,
  };

  return { buffer: cropped.toPNG(), selection };
}

module.exports = { captureAroundPoint, captureRegion };
