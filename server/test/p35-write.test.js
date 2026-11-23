import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, '../scripts/p35-write-check.mjs');

describe('P3.5 Write Integration Test', () => {
  it('executes full write-path workflow on isolated database copy with zero leakage', () => {
    const output = execFileSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 60000,
    });
    expect(output).toMatch(/P3\.5 Write (?:& Concurrency )?Summary: \d+ passed, 0 failed/);
    expect(output).toContain('Final dev.db total row count remains strictly 81');
  }, 70000);
});

