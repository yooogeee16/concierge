const sectionsEl = document.getElementById('sections');
const searchEl = document.getElementById('search');
const statsEl = document.getElementById('stats');

let allEntries = [];

function groupEntries(entries) {
  const order = [];
  const byGroup = new Map();
  for (const entry of entries) {
    if (!byGroup.has(entry.group)) {
      byGroup.set(entry.group, { key: entry.group, label: entry.groupLabel, icon: entry.groupIcon, items: [] });
      order.push(entry.group);
    }
    byGroup.get(entry.group).items.push(entry);
  }
  return order.map((key) => byGroup.get(key));
}

function renderCard(entry) {
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
  return card;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const groups = groupEntries(allEntries);

  sectionsEl.innerHTML = '';
  for (const group of groups) {
    const discoveredInGroup = group.items.filter((e) => e.count > 0).length;
    const visibleItems = query ? group.items.filter((e) => e.label.toLowerCase().includes(query)) : group.items;

    const section = document.createElement('div');
    section.className = `section${visibleItems.length === 0 ? ' empty' : ''}`;

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="section-icon">${group.icon}</span>
      <span class="section-title">${group.label}</span>
      <span class="section-progress-text">発見済み ${discoveredInGroup} / ${group.items.length}</span>
    `;

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${group.items.length ? (discoveredInGroup / group.items.length) * 100 : 0}%`;
    track.appendChild(fill);

    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const entry of visibleItems) grid.appendChild(renderCard(entry));

    section.appendChild(header);
    section.appendChild(track);
    section.appendChild(grid);
    sectionsEl.appendChild(section);
  }

  const totalDiscovered = allEntries.filter((e) => e.count > 0).length;
  statsEl.textContent = `発見済み ${totalDiscovered} / ${allEntries.length}`;
}

searchEl.addEventListener('input', render);

window.codedexAPI.list().then((entries) => {
  allEntries = entries;
  render();
});
