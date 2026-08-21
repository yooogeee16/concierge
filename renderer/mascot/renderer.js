const stageEl = document.getElementById('stage');
const spriteEl = document.getElementById('sprite');
const hintEl = document.getElementById('hint');

let hintTimer = null;
let currentCharacter = 'navy';
let currentLookup = false;

function spriteSrc(character, lookup) {
  return `../assets/mascot-${character}-${lookup ? 'lookup' : 'idle'}.svg`;
}

function applyState(state) {
  if (state.character) currentCharacter = state.character;
  currentLookup = state.mode === 'lookup';
  spriteEl.src = spriteSrc(currentCharacter, currentLookup);
  stageEl.classList.toggle('lookup', currentLookup);
  stageEl.classList.toggle('thinking', !!state.thinking);
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
