const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const noteEl = document.getElementById('note');
const disclaimerEl = document.getElementById('disclaimer');

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// 見出し(##/###)・箇条書き(-/1.)・区切り線(---)・太字だけを扱う簡易Markdown変換。
// 入れ子の箇条書きは正式なHTMLネストにはせず、インデント幅に応じて左マージンを
// 変えた別リストとして描画する(見た目のインデントを再現できれば十分なため)。
function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let listType = null;
  let listLevel = null;

  function closeList() {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
      listLevel = null;
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');

    if (/^\s*---+\s*$/.test(line)) {
      closeList();
      html += '<hr>';
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${renderInline(heading[2].trim())}</h${level}>`;
      continue;
    }

    const ordered = line.match(/^(\s*)\d+\.\s+(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ordered || bullet) {
      const indent = (ordered || bullet)[1].length;
      const content = ordered ? ordered[2] : bullet[2];
      const type = ordered ? 'ol' : 'ul';
      const level = Math.floor(indent / 2);
      if (listType !== type || listLevel !== level) {
        closeList();
        html += `<${type} style="margin-left:${level * 18}px">`;
        listType = type;
        listLevel = level;
      }
      html += `<li>${renderInline(content.trim())}</li>`;
      continue;
    }

    if (line.trim() === '') {
      closeList();
      continue;
    }

    closeList();
    html += `<p>${renderInline(line.trim())}</p>`;
  }
  closeList();
  return html;
}

function render(data) {
  if (data.persona && data.persona.accent) {
    document.documentElement.style.setProperty('--accent', data.persona.accent);
  }

  switch (data.status) {
    case 'empty':
      statusEl.classList.remove('hidden');
      noteEl.classList.add('hidden');
      disclaimerEl.classList.add('hidden');
      statusTextEl.textContent = '文字を認識できませんでした。もう少し広めにドラッグしてみてください。';
      break;
    case 'error':
      statusEl.classList.remove('hidden');
      noteEl.classList.add('hidden');
      disclaimerEl.classList.add('hidden');
      statusTextEl.textContent = data.error || 'エラーが発生しました。';
      statusTextEl.classList.add('error-text');
      break;
    case 'done':
      statusEl.classList.add('hidden');
      noteEl.classList.remove('hidden');
      disclaimerEl.classList.remove('hidden');
      noteEl.innerHTML = markdownToHtml(data.markdown || '');
      break;
    default:
      break;
  }
}

window.detailAPI.onUpdate(render);
