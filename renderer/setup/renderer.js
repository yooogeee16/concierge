const linkEl = document.getElementById('link');
const inputEl = document.getElementById('apiKey');
const saveEl = document.getElementById('save');
const skipEl = document.getElementById('skip');

linkEl.addEventListener('click', (e) => {
  e.preventDefault();
  window.setupAPI.openLink('https://aistudio.google.com/apikey');
});

saveEl.addEventListener('click', () => {
  const key = inputEl.value.trim();
  if (!key) {
    inputEl.focus();
    return;
  }
  window.setupAPI.save(key);
});

skipEl.addEventListener('click', () => {
  window.setupAPI.skip();
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEl.click();
});

window.setupAPI.onPrefill((apiKey) => {
  if (apiKey) inputEl.value = apiKey;
});
