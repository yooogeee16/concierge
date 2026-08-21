const termEl = document.getElementById('term');
const textEl = document.getElementById('text');
const spinnerEl = document.getElementById('spinner');
const disclaimerEl = document.getElementById('disclaimer');
const sourcesEl = document.getElementById('sources');
const cardEl = document.getElementById('card');
const closeEl = document.getElementById('close');
const actionsEl = document.getElementById('actions');
const retryEl = document.getElementById('retry');
const saveEl = document.getElementById('save');

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
  // AIが挙げた根拠に加え、Wikipedia検索への確実なリンクを常に添える(AIによるURL生成に頼らないための保険)
  if (term) items.push({ title: `Wikipediaで「${term}」を検索`, uri: wikipediaSearchUrl(term) });

  if (items.length === 0) {
    sourcesEl.classList.add('hidden');
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = item.title;
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.popupAPI.openLink(item.uri);
    });
    li.appendChild(a);
    sourcesEl.appendChild(li);
  }
  sourcesEl.classList.remove('hidden');
}

function render(data) {
  const persona = data.persona;
  if (persona && persona.accent) {
    cardEl.style.setProperty('--accent', persona.accent);
  }

  termEl.textContent = data.term || '';
  disclaimerEl.classList.add('hidden');
  sourcesEl.classList.add('hidden');
  textEl.classList.remove('error-text');

  saveEl.disabled = false;
  saveEl.textContent = '辞書に登録';

  switch (data.status) {
    case 'loading':
      spinnerEl.classList.remove('hidden');
      textEl.textContent = data.term
        ? (persona && persona.loadingTerm) || '説明を調べています…'
        : (persona && persona.loadingBlind) || '文字を読み取っています…';
      actionsEl.classList.add('hidden');
      break;
    case 'empty':
      spinnerEl.classList.add('hidden');
      textEl.textContent = (persona && persona.empty) || '文字を認識できませんでした。もう少し文字に近づけてクリックしてください。';
      actionsEl.classList.remove('hidden');
      saveEl.classList.add('hidden');
      retryEl.classList.remove('hidden');
      break;
    case 'error':
      spinnerEl.classList.add('hidden');
      textEl.textContent = data.error || 'エラーが発生しました。';
      textEl.classList.add('error-text');
      if (data.term) renderSources(data.term, []);
      actionsEl.classList.remove('hidden');
      saveEl.classList.add('hidden');
      retryEl.classList.remove('hidden');
      break;
    case 'done':
      spinnerEl.classList.add('hidden');
      textEl.textContent = data.text || '';
      disclaimerEl.textContent = (persona && persona.disclaimer) || 'AIによる説明のため、誤りを含む場合があります。';
      disclaimerEl.classList.remove('hidden');
      renderSources(data.term, data.sources);
      actionsEl.classList.remove('hidden');
      saveEl.classList.remove('hidden');
      retryEl.classList.remove('hidden');
      break;
    default:
      break;
  }

  requestAnimationFrame(() => {
    const height = cardEl.getBoundingClientRect().height;
    window.popupAPI.reportSize({ height });
  });
}

window.popupAPI.onUpdate(render);

closeEl.addEventListener('click', () => {
  window.popupAPI.close();
});

retryEl.addEventListener('click', () => {
  window.popupAPI.retry();
});

saveEl.addEventListener('click', async () => {
  saveEl.disabled = true;
  const result = await window.popupAPI.saveToDictionary();
  saveEl.textContent = result && result.ok ? '登録しました' : '登録できませんでした';
});
