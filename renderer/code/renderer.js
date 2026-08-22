const dropEl = document.getElementById('drop');
const fileInputEl = document.getElementById('fileInput');
const resultEl = document.getElementById('result');
const filenameEl = document.getElementById('filename');
const langBadgeEl = document.getElementById('langBadge');
const resetEl = document.getElementById('reset');
const summarySpinnerEl = document.getElementById('summarySpinner');
const summaryTextEl = document.getElementById('summaryText');
const summaryDisclaimerEl = document.getElementById('summaryDisclaimer');
const librariesEl = document.getElementById('libraries');
const codeViewerEl = document.getElementById('codeViewer');

function showDrop() {
  dropEl.classList.remove('hidden');
  resultEl.classList.add('hidden');
}

function renderChips(container, items) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.classList.add('hidden');
    return;
  }
  for (const item of items) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.title = item.description || '';
    chip.textContent = `${item.icon || ''} ${item.label}${item.count > 1 ? ` ×${item.count}` : ''}`;
    container.appendChild(chip);
  }
  container.classList.remove('hidden');
}

function renderCode(codeExcerpt, namedItems, explanationItems) {
  codeViewerEl.innerHTML = '';
  const lines = codeExcerpt.split('\n');
  const itemsByLine = new Map();
  for (const item of namedItems || []) itemsByLine.set(item.line, item.name);
  const explainByName = new Map();
  for (const item of explanationItems || []) explainByName.set(item.name, item.explanation);

  lines.forEach((lineText, idx) => {
    const lineNo = idx + 1;
    const row = document.createElement('div');
    row.className = 'code-line';

    const noEl = document.createElement('span');
    noEl.className = 'line-no';
    noEl.textContent = String(lineNo);

    const codeEl = document.createElement('span');
    codeEl.className = 'line-code';
    codeEl.textContent = lineText;

    row.appendChild(noEl);
    row.appendChild(codeEl);

    const name = itemsByLine.get(lineNo);
    if (name) {
      const btn = document.createElement('span');
      btn.className = 'bubble-btn';
      btn.textContent = `💬 ${name}`;
      btn.addEventListener('click', () => {
        const existing = row.nextElementSibling;
        if (existing && existing.classList.contains('bubble-panel') && existing.dataset.name === name) {
          existing.remove();
          return;
        }
        document.querySelectorAll('.bubble-panel').forEach((el) => el.remove());
        const panel = document.createElement('div');
        panel.className = 'bubble-panel';
        panel.dataset.name = name;
        const explanation = explainByName.get(name);
        panel.innerHTML = `<div class="name">${name}</div><div>${explanation || 'この項目のAI解説は取得できませんでした。'}</div>`;
        row.after(panel);
      });
      row.appendChild(btn);
    }

    codeViewerEl.appendChild(row);
  });
}

async function analyzeFile(file) {
  showDrop();
  dropEl.classList.add('hidden');
  resultEl.classList.remove('hidden');

  filenameEl.textContent = file.name;
  langBadgeEl.textContent = '解析中…';
  summarySpinnerEl.classList.remove('hidden');
  summaryTextEl.textContent = '';
  summaryDisclaimerEl.classList.add('hidden');
  librariesEl.classList.add('hidden');
  codeViewerEl.innerHTML = '';

  let content;
  try {
    content = await file.text();
  } catch (err) {
    summarySpinnerEl.classList.add('hidden');
    summaryTextEl.textContent = `ファイルを読み込めませんでした: ${err.message}`;
    return;
  }

  const result = await window.codeAPI.analyze({ filename: file.name, content });

  if (!result.ok) {
    langBadgeEl.textContent = '';
    summarySpinnerEl.classList.add('hidden');
    summaryTextEl.textContent = result.error || '解析に失敗しました。';
    return;
  }

  langBadgeEl.textContent = result.language.label;
  summarySpinnerEl.classList.add('hidden');

  if (result.explanation && result.explanation.ok) {
    summaryTextEl.textContent = result.explanation.summary || '(概要を生成できませんでした)';
    summaryDisclaimerEl.classList.remove('hidden');
  } else {
    summaryTextEl.textContent = (result.explanation && result.explanation.error) || 'AIによる概要は取得できませんでした。';
  }

  renderChips(librariesEl, [...(result.libraries || []), ...(result.unknownLibraries || [])]);
  renderCode(result.codeExcerpt, result.namedItems, result.explanation && result.explanation.items);
}

dropEl.addEventListener('click', () => fileInputEl.click());

dropEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropEl.classList.add('dragover');
});
dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
dropEl.addEventListener('drop', (e) => {
  e.preventDefault();
  dropEl.classList.remove('dragover');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) analyzeFile(file);
});

fileInputEl.addEventListener('change', () => {
  const file = fileInputEl.files && fileInputEl.files[0];
  if (file) analyzeFile(file);
  fileInputEl.value = '';
});

resetEl.addEventListener('click', showDrop);
