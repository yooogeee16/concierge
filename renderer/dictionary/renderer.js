const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function render(list) {
  listEl.innerHTML = '';
  emptyEl.classList.toggle('hidden', list.length > 0);

  for (const entry of list) {
    const li = document.createElement('li');

    const term = document.createElement('div');
    term.className = 'term';
    term.textContent = entry.term;

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = entry.text;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const links = document.createElement('span');
    for (const s of entry.sources || []) {
      const a = document.createElement('a');
      a.textContent = '出典';
      a.title = s.title;
      a.addEventListener('click', () => window.dictionaryAPI.openLink(s.uri));
      links.appendChild(a);
    }

    const dateEl = document.createElement('span');
    dateEl.textContent = formatDate(entry.savedAt);

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '削除';
    del.addEventListener('click', async () => {
      const next = await window.dictionaryAPI.remove(entry.term);
      render(next);
    });

    meta.appendChild(links);
    meta.appendChild(dateEl);
    meta.appendChild(del);

    li.appendChild(term);
    li.appendChild(text);
    li.appendChild(meta);
    listEl.appendChild(li);
  }
}

window.dictionaryAPI.list().then(render);
