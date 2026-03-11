#!/usr/bin/env node
/**
 * Start proxy server then Vite. Cross-platform (no reliance on & or ;).
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxy = spawn('node', [path.join(__dirname, 'proxy-server.cjs')], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
});
proxy.stdout.on('data', (d) => process.stdout.write(d));
proxy.stderr.on('data', (d) => process.stderr.write(d));
proxy.on('error', (err) => {
  console.error('[dev] Proxy failed:', err.message);
  process.exit(1);
});

// Give proxy a moment to bind
setTimeout(() => {
  const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  vite.on('close', (code) => {
    proxy.kill();
    process.exit(code ?? 0);
  });
}, 800);
