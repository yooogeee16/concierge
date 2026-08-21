const fs = require('fs');
const path = require('path');

function getStorePath(app) {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(app) {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(app), 'utf-8'));
  } catch {
    return {};
  }
}

function saveSettings(app, settings) {
  const p = getStorePath(app);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
}

module.exports = { loadSettings, saveSettings };
