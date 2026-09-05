const stageEl = document.getElementById('stage');
const spriteEl = document.getElementById('sprite');
const hintEl = document.getElementById('hint');

let hintTimer = null;
let currentCharacter = 'navy';

const HINT_TEXT = {
  idle: 'クリックで調べるモード / まわりをドラッグで移動',
  lookup: 'クリックでもう一度押すと詳しく解説モードへ',
  detail: 'ドラッグした範囲を詳しく解説します',
};

function spriteSrc(character, mode) {
  return `../assets/mascot-${character}-${mode === 'idle' ? 'idle' : 'lookup'}.svg`;
}

function applyState(state) {
  if (state.character) currentCharacter = state.character;
  const mode = state.mode || 'idle';
  spriteEl.src = spriteSrc(currentCharacter, mode);
  stageEl.classList.toggle('lookup', mode === 'lookup');
  stageEl.classList.toggle('detail', mode === 'detail');
  stageEl.classList.toggle('thinking', !!state.thinking);
  hintEl.textContent = HINT_TEXT[mode] || HINT_TEXT.idle;
}

function applyWalk(state) {
  stageEl.classList.toggle('walking', !!state.walking);
  stageEl.classList.toggle('facing-left', state.facing === 'left');
}

window.mascotAPI.onState(applyState);
window.mascotAPI.onWalk(applyWalk);

spriteEl.addEventListener('click', () => {
  window.mascotAPI.toggleLookup();
});

spriteEl.addEventListener('mouseenter', () => {
  hintEl.classList.remove('hidden');
  clearTimeout(hintTimer);
});

spriteEl.addEventListener('mouseleave', () => {
  hintTimer = setTimeout(() => hintEl.classList.add('hidden'), 150);
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.mascotAPI.requestContextMenu();
});
