const questionEl = document.getElementById('question');
const textEl = document.getElementById('text');
const sourcesEl = document.getElementById('sources');
const wrapEl = document.getElementById('wrap');
const cardEl = document.getElementById('card');
const closeEl = document.getElementById('close');
const rememberedEl = document.getElementById('remembered');
const forgotEl = document.getElementById('forgot');

let currentTerm = null;

function wikipediaSearchUrl(term) {
  return `https://ja.wikipedia.org/w/index.php?search=${encodeURIComponent(term)}`;
}

function renderSources(term, sources) {
  sourcesEl.innerHTML = '';
  const items = [];
  if (Array.isArray(sources)) {
    for (const s of sources) {
      if (s && s.uri) items.push({ title: s.title || s.uri, uri: s.uri });
    }
  }
  if (term) items.push({ title: `Wikipediaで「${term}」を検索`, uri: wikipediaSearchUrl(term) });

  for (const item of items) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = item.title;
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.quizAPI.openLink(item.uri);
    });
    li.appendChild(a);
    sourcesEl.appendChild(li);
  }
  sourcesEl.classList.toggle('hidden', items.length === 0);
}

window.quizAPI.onShow(({ entry, persona, side }) => {
  currentTerm = entry.term;
  if (persona && persona.accent) {
    cardEl.style.setProperty('--accent', persona.accent);
  }
  wrapEl.classList.toggle('below', side === 'below');

  const template = (persona && persona.quizQuestion) || '「{term}」って覚えてる?';
  questionEl.textContent = template.replace('{term}', entry.term);
  textEl.textContent = entry.text || '';
  renderSources(entry.term, entry.sources);

  requestAnimationFrame(() => {
    // しっぽ分も含めたウィンドウ全体の高さを報告する
    const height = wrapEl.getBoundingClientRect().height;
    window.quizAPI.reportSize({ height });
  });
});

// マスコットとの位置関係(上/下)が変わったら、吹き出しのしっぽの向きだけ切り替える
window.quizAPI.onSide((side) => {
  wrapEl.classList.toggle('below', side === 'below');
});

closeEl.addEventListener('click', () => {
  window.quizAPI.close();
});

// 回答を記録してからウィジェットを閉じる(「覚えてない」は次回以降出題されやすくなる)
rememberedEl.addEventListener('click', () => {
  if (currentTerm) window.quizAPI.respond(currentTerm, 'remembered');
  window.quizAPI.close();
});

forgotEl.addEventListener('click', () => {
  if (currentTerm) window.quizAPI.respond(currentTerm, 'forgot');
  window.quizAPI.close();
});
