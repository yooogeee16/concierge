const gridEl = document.getElementById('grid');
const searchEl = document.getElementById('search');
const statsEl = document.getElementById('stats');
const tabEls = [...document.querySelectorAll('.tab')];

let allEntries = [];
let activeCategory = 'all';

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const filtered = allEntries.filter((e) => {
    if (activeCategory !== 'all' && e.category !== activeCategory) return false;
    if (query && !e.label.toLowerCase().includes(query)) return false;
    return true;
  });

  gridEl.innerHTML = '';
  for (const entry of filtered) {
    const discovered = entry.count > 0;
    const card = document.createElement('div');
    card.className = `dex-card${discovered ? '' : ' undiscovered'}`;

    const icon = document.createElement('div');
    icon.className = 'dex-icon';
    icon.textContent = discovered ? entry.icon : '❔';

    const label = document.createElement('div');
    label.className = 'dex-label';
    label.textContent = entry.label;

    const desc = document.createElement('div');
    desc.className = 'dex-desc';
    desc.textContent = discovered ? entry.description : 'まだ見つけていません';

    const count = document.createElement('div');
    count.className = 'dex-count';
    count.textContent = discovered ? `×${entry.count}` : '未発見';

    card.appendChild(icon);
    card.appendChild(label);
    card.appendChild(desc);
    card.appendChild(count);
    gridEl.appendChild(card);
  }

  const discoveredCount = allEntries.filter((e) => e.count > 0).length;
  statsEl.textContent = `発見済み ${discoveredCount} / ${allEntries.length}`;
}

tabEls.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabEls.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeCategory = tab.dataset.cat;
    render();
  });
});

searchEl.addEventListener('input', render);

window.codedexAPI.list().then((entries) => {
  allEntries = entries.sort((a, b) => b.count - a.count);
  render();
});
