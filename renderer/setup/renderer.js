const linkEl = document.getElementById('link');
const inputEl = document.getElementById('apiKey');
const saveEl = document.getElementById('save');
const skipEl = document.getElementById('skip');
const randomnessEl = document.getElementById('quizRandomness');
const randomnessValueEl = document.getElementById('quizRandomnessValue');
const intervalEl = document.getElementById('quizInterval');

linkEl.addEventListener('click', (e) => {
  e.preventDefault();
  window.setupAPI.openLink('https://aistudio.google.com/apikey');
});

randomnessEl.addEventListener('input', () => {
  randomnessValueEl.textContent = `${randomnessEl.value}%`;
});

saveEl.addEventListener('click', () => {
  const key = inputEl.value.trim();
  if (!key) {
    inputEl.focus();
    return;
  }
  window.setupAPI.save({
    apiKey: key,
    quizRandomness: Number(randomnessEl.value),
    quizIntervalMinutes: Number(intervalEl.value),
  });
});

skipEl.addEventListener('click', () => {
  window.setupAPI.skip();
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEl.click();
});

window.setupAPI.onPrefill((data) => {
  if (!data) return;
  if (data.apiKey) inputEl.value = data.apiKey;
  if (typeof data.quizRandomness === 'number') {
    randomnessEl.value = data.quizRandomness;
    randomnessValueEl.textContent = `${data.quizRandomness}%`;
  }
  if (typeof data.quizIntervalMinutes === 'number') {
    intervalEl.value = data.quizIntervalMinutes;
  }
});
