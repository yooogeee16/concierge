const os = require('os');
const { execFile } = require('child_process');

const REFRESH_MS = 4000;

let prevCpuCores = os.cpus();
let cache = {
  disks: [],
  network: { sentPerSec: 0, recvPerSec: 0 },
  ready: false,
};
let prevNetSample = null; // { at, sent, recv }
let refreshTimer = null;

function cpuTimesTotal(cores) {
  let user = 0;
  let sys = 0;
  let idle = 0;
  let total = 0;
  for (const c of cores) {
    user += c.times.user;
    sys += c.times.sys;
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { user, sys, idle, total };
}

// 直近サンプルとの差分からCPU使用率(ユーザー/カーネル/使用可能)を算出する
function sampleCpu() {
  const cores = os.cpus();
  const prev = cpuTimesTotal(prevCpuCores);
  const now = cpuTimesTotal(cores);
  prevCpuCores = cores;

  const totalDelta = now.total - prev.total;
  if (totalDelta <= 0) return { percent: 0, user: 0, kernel: 0, idle: 100 };

  const user = Math.max(0, ((now.user - prev.user) / totalDelta) * 100);
  const kernel = Math.max(0, ((now.sys - prev.sys) / totalDelta) * 100);
  const idle = Math.max(0, ((now.idle - prev.idle) / totalDelta) * 100);
  return { percent: Math.min(100, user + kernel), user, kernel, idle };
}

function sampleMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return { total, used, free, percent: (used / total) * 100 };
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 4000, windowsHide: true },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(String(stdout).trim());
      }
    );
  });
}

async function refreshDisks() {
  try {
    const out = await runPowerShell(
      "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | ForEach-Object { \"$($_.DeviceID)|$($_.Size)|$($_.FreeSpace)\" }"
    );
    const disks = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [device, size, free] = line.split('|');
        const sizeNum = Number(size) || 0;
        const freeNum = Number(free) || 0;
        return { device, size: sizeNum, free: freeNum, used: sizeNum - freeNum };
      });
    cache.disks = disks;
  } catch {
    // 取得できない環境ではそのまま(前回値 or 空)を維持する
  }
}

async function refreshNetwork() {
  try {
    const out = await runPowerShell(
      '$s = Get-NetAdapterStatistics; $sent = ($s | Measure-Object -Property SentBytes -Sum).Sum; $recv = ($s | Measure-Object -Property ReceivedBytes -Sum).Sum; "$sent,$recv"'
    );
    const [sentStr, recvStr] = out.split(',');
    const sent = Number(sentStr) || 0;
    const recv = Number(recvStr) || 0;
    const now = Date.now();
    if (prevNetSample) {
      const dtSec = (now - prevNetSample.at) / 1000;
      if (dtSec > 0) {
        cache.network = {
          sentPerSec: Math.max(0, (sent - prevNetSample.sent) / dtSec),
          recvPerSec: Math.max(0, (recv - prevNetSample.recv) / dtSec),
        };
      }
    }
    prevNetSample = { at: now, sent, recv };
  } catch {
    // 取得できない環境ではそのまま維持する
  }
}

async function refreshAll() {
  await Promise.all([refreshDisks(), refreshNetwork()]);
  cache.ready = true;
}

function start() {
  if (refreshTimer) return;
  refreshAll();
  refreshTimer = setInterval(refreshAll, REFRESH_MS);
}

function stop() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '取得できません';
  const gb = bytes / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

function formatRate(bytesPerSec) {
  if (!Number.isFinite(bytesPerSec)) return '取得できません';
  if (bytesPerSec >= 1e6) return `${(bytesPerSec / 1e6).toFixed(2)} MB/s`;
  if (bytesPerSec >= 1e3) return `${(bytesPerSec / 1e3).toFixed(2)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

// メニュー表示用に、あらかじめ整形した行の配列を返す(取得できない項目はその旨を明記する)
function getSnapshotLines() {
  const cpu = sampleCpu();
  const mem = sampleMemory();
  const lines = [];

  lines.push(`CPU: ${cpu.percent.toFixed(1)}%`);
  lines.push(`├─ユーザー: ${cpu.user.toFixed(1)}%`);
  lines.push(`├─カーネル: ${cpu.kernel.toFixed(1)}%`);
  lines.push(`└─使用可能: ${cpu.idle.toFixed(1)}%`);

  lines.push(`メモリ: ${mem.percent.toFixed(1)}%`);
  lines.push(`├─合計: ${formatBytes(mem.total)}`);
  lines.push(`├─使用中: ${formatBytes(mem.used)}`);
  lines.push(`└─使用可能: ${formatBytes(mem.free)}`);

  lines.push('ストレージ:');
  if (cache.disks.length === 0) {
    lines.push('└─取得できません');
  } else {
    cache.disks.forEach((d, i) => {
      const isLast = i === cache.disks.length - 1;
      const branch = isLast ? '└─' : '├─';
      const pad = isLast ? '   ' : '│  ';
      const percent = d.size > 0 ? (d.used / d.size) * 100 : 0;
      const label = d.device.replace(/:$/, '');
      lines.push(`${branch}${label}ドライブ: ${percent.toFixed(1)}%`);
      lines.push(`${pad}├─使用中: ${formatBytes(d.used)}`);
      lines.push(`${pad}└─使用可能: ${formatBytes(d.free)}`);
    });
  }

  lines.push('ネットワーク:');
  lines.push(`├─送信: ${formatRate(cache.network.sentPerSec)}`);
  lines.push(`└─受信: ${formatRate(cache.network.recvPerSec)}`);

  return lines;
}

module.exports = { start, stop, getSnapshotLines };
