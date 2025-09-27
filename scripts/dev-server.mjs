#!/usr/bin/env node
import { spawn } from 'child_process';

const extraArgs = process.argv.slice(2);
const nextArgs = ['next', 'dev', '-p', '9002', ...extraArgs];
const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let warmed = false;
const warmLog = (...args) => console.log('[warmup]', ...args);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTextWithRetry(route, label = route) {
  const url = `http://localhost:9002${route}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const text = await res.text();
      warmLog(`ok ${label}`);
      return text;
    } catch (error) {
      warmLog(`retry ${label} (${error.message || error})`);
      await wait(250);
    }
  }
  warmLog(`gave up on ${label}`);
  return null;
}

async function warmup() {
  if (warmed) return;
  warmed = true;
  warmLog('starting preflight requests');
  // Wait a moment to let webpack finish writing chunks
  await wait(300);

  const homeHtml = await fetchTextWithRetry('/');
  if (homeHtml) {
    const cssMatches = new Set();
    const cssRegex = /href="(\/\_next\/static\/css\/[^"?]+(?:\?[^"']*)?)"/g;
    let match;
    while ((match = cssRegex.exec(homeHtml)) !== null) {
      cssMatches.add(match[1]);
    }
    for (const cssPath of cssMatches) {
      await fetchTextWithRetry(cssPath, `${cssPath}`);
    }
  }
  warmLog('complete');
}

const child = spawn(runner, nextArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
});

const checkBuffer = (chunk) => {
  const value = chunk.toString();
  if (!warmed && value.includes('ready - started server on')) {
    warmup().catch((err) => warmLog('failed', err));
  }
};

child.stdout.on('data', (data) => {
  process.stdout.write(data);
  checkBuffer(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
  checkBuffer(data);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
