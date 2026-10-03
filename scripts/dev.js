#!/usr/bin/env node
/** Runs the API and the Vite dev server together, with prefixed output. */
import { spawn } from 'node:child_process';

const targets = [
  { name: 'api', color: '\x1b[36m', args: ['--prefix', 'backend', 'run', 'dev'] },
  { name: 'web', color: '\x1b[35m', args: ['--prefix', 'frontend', 'run', 'dev'] },
];

const children = targets.map(({ name, color, args }) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `${color}[${name}]\x1b[0m `;
  const write = (stream) => (chunk) =>
    String(chunk).split('\n').filter(Boolean).forEach((line) => stream.write(prefix + line + '\n'));
  child.stdout.on('data', write(process.stdout));
  child.stderr.on('data', write(process.stderr));
  child.on('exit', (code) => {
    console.log(`${prefix}exited with code ${code}`);
    shutdown();
  });
  return child;
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  children.forEach((c) => c.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
