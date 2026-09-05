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

    const row = document.createElement('div');
    row.className = 'term-row';

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '▶';

    const name = document.createElement('div');
    name.className = 'term-name';
    name.textContent = entry.term;

    row.appendChild(chevron);
    row.appendChild(name);

    const detail = document.createElement('div');
    detail.className = 'detail';

    const inner = document.createElement('div');
    inner.className = 'detail-inner';

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
      a.addEventListener('click', (e) => {
        e.stopPropagation();
        window.dictionaryAPI.openLink(s.uri);
      });
      links.appendChild(a);
    }

    const dateEl = document.createElement('span');
    dateEl.textContent = formatDate(entry.savedAt);

    const del = document.createElement('button');
    del.className = 'delete';
    del.textContent = '削除';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const next = await window.dictionaryAPI.remove(entry.term);
      render(next);
    });

    meta.appendChild(links);
    meta.appendChild(dateEl);
    meta.appendChild(del);

    inner.appendChild(text);
    inner.appendChild(meta);
    detail.appendChild(inner);

    row.addEventListener('click', () => {
      li.classList.toggle('open');
    });

    li.appendChild(row);
    li.appendChild(detail);
    listEl.appendChild(li);
  }
}

window.dictionaryAPI.list().then(render);
