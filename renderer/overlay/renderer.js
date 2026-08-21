const markerEl = document.getElementById('marker');

let dragging = false;
let startX = 0;
let startY = 0;

function setMarker(x0, y0, x1, y1) {
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y1 - y0);
  markerEl.style.left = `${left}px`;
  markerEl.style.top = `${top}px`;
  markerEl.style.width = `${width}px`;
  markerEl.style.height = `${height}px`;
}

document.body.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  setMarker(startX, startY, startX, startY);
  markerEl.classList.remove('hidden');
});

document.body.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  setMarker(startX, startY, e.clientX, e.clientY);
});

document.body.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  markerEl.classList.add('hidden');
  window.overlayAPI.select({ x0: startX, y0: startY, x1: e.clientX, y1: e.clientY });
});

document.body.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.overlayAPI.cancel();
});
