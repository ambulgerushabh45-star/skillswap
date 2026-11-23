// prisma/seed.js - Invokes the server MongoDB seed script
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedScript = path.resolve(__dirname, '..', 'server', 'scripts', 'seed.mjs');
const res = spawnSync(process.execPath, [seedScript], { stdio: 'inherit' });
process.exit(res.status ?? 0);
