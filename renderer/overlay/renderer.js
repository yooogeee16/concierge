document.body.addEventListener('click', () => {
  window.overlayAPI.click();
});

document.body.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.overlayAPI.cancel();
});
