// scripts/dev.mjs
// Unified development orchestrator launching Express backend (4000) and Vite frontend (5173).
// Plain Node ESM with zero external dependencies.

import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';

const processes = [];
let shuttingDown = false;

function prefixStream(stream, prefix, target) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  rl.on('line', (line) => {
    target.write(`${prefix} ${line}\n`);
  });
}

function terminateTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      child.kill('SIGTERM');
    } catch {
      // already exited
    }
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[dev] Stopping server and client...');
  for (const child of processes) {
    terminateTree(child);
  }
  process.exit(exitCode);
}

function startService(name, prefix, args) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const spawnArgs = isWin ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;

  const child = spawn(cmd, spawnArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  });

  prefixStream(child.stdout, prefix, process.stdout);
  prefixStream(child.stderr, prefix, process.stderr);

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[dev] ${name} exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}). Shutting down...`);
      shutdown(code && code !== 0 ? code : 1);
    }
  });

  processes.push(child);
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev] Starting SkillSwap Express server and React Vite client...');
startService('server', '[server]', ['--prefix', 'server', 'run', 'dev']);
startService('client', '[client]', ['--prefix', 'client', 'run', 'dev']);
