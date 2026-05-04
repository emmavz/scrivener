#!/usr/bin/env node
/**
 * Runs Vite on a stable port (default 5173) so localStorage origin stays the same between runs,
 * then runs `tauri dev` with `--config` so `devUrl` matches and `beforeDevCommand` is skipped.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** @param {number} port @param {string} host */
function portFree(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      if (code === 'EADDRINUSE') resolve(false);
      else reject(err);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function waitForDevServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok || res.status === 304) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for dev server ${url}`);
}

/** @type {import('node:child_process').ChildProcess | null} */
let tauriProc = null;

const port = Number(process.env.VITE_DEV_PORT ?? 5173);
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error(`[tauri:dev] Invalid VITE_DEV_PORT: ${process.env.VITE_DEV_PORT}`);
  process.exit(1);
}

if (!(await portFree(port))) {
  console.error(
    `[tauri:dev] Port ${port} is already in use. Stop the other Vite/Tauri dev server, or run with a free port, e.g.:\n  VITE_DEV_PORT=5174 npm run tauri:dev`,
  );
  process.exit(1);
}

const devUrl = `http://127.0.0.1:${port}`;
console.log(`[tauri:dev] starting Vite on ${devUrl}`);

const vite = spawn(
  'npm',
  ['run', 'dev', '--', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env },
  },
);

function killVite() {
  try {
    vite.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

function killTauri() {
  try {
    if (tauriProc && !tauriProc.killed) {
      tauriProc.kill('SIGTERM');
    }
  } catch {
    /* ignore */
  }
}

function shutdown(signal) {
  killTauri();
  killVite();
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

vite.on('error', (err) => {
  console.error(err);
  killTauri();
  process.exit(1);
});

vite.on('exit', (code, signal) => {
  if (!tauriProc) {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code && code !== 0 ? code : 1);
    return;
  }
  killTauri();
  if (signal) process.exit(1);
  process.exit(code && code !== 0 ? code : 1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await waitForDevServer(devUrl);
} catch (e) {
  console.error(e.message ?? e);
  killVite();
  process.exit(1);
}

const merged = JSON.stringify({
  build: {
    devUrl,
    beforeDevCommand: null,
  },
});

const cargoBin = `${process.env.HOME ?? ''}/.cargo/bin`;
const tauriEnv = {
  ...process.env,
  PATH: `${cargoBin}:${process.env.PATH ?? ''}`,
};

tauriProc = spawn('npx', ['tauri', 'dev', '--config', merged], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: false,
  env: tauriEnv,
});

tauriProc.on('error', (err) => {
  console.error(err);
  killVite();
  process.exit(1);
});

tauriProc.on('exit', (code, signal) => {
  killVite();
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
