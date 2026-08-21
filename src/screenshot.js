const { desktopCapturer, screen } = require('electron');

const CROP_W = 480;
const CROP_H = 140;

// クリック位置周辺をキャプチャする。現状は単一ディスプレイ(カーソルがあるディスプレイ)を前提にしている。
async function captureAroundPoint(point) {
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
  const buffer = cropped.toPNG();

  return { buffer, cx: localX - x, cy: localY - y };
}

module.exports = { captureAroundPoint };
