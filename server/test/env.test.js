import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Environment Validation Logic', () => {
  const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().default('file:../../prisma/dev.db'),
    JWT_SECRET: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  });

  function validateProductionSecret(secret, nodeEnv = 'production') {
    const isPlaceholder =
      secret === 'skillswap-super-secret-jwt-key-min-32-chars-long-development' ||
      secret === 'changeme-min-32-characters-required-for-jwt-secret';

    if (nodeEnv === 'production') {
      if (!secret || secret.length < 32 || isPlaceholder) {
        throw new Error('FATAL: In production, JWT_SECRET must be set, at least 32 characters, and not a placeholder.');
      }
    }
    return true;
  }

  it('accepts valid production secret with >= 32 characters', () => {
    const validSecret = 'a-very-strong-production-jwt-secret-key-1234567890';
    expect(validateProductionSecret(validSecret, 'production')).toBe(true);
  });

  it('rejects missing or short JWT_SECRET in production', () => {
    expect(() => validateProductionSecret('', 'production')).toThrow(/FATAL/);
    expect(() => validateProductionSecret('too-short-secret', 'production')).toThrow(/FATAL/);
    expect(() => validateProductionSecret(undefined, 'production')).toThrow(/FATAL/);
  });

  it('rejects placeholder JWT_SECRET in production', () => {
    expect(() =>
      validateProductionSecret(
        'skillswap-super-secret-jwt-key-min-32-chars-long-development',
        'production'
      )
    ).toThrow(/FATAL/);
  });

  it('coerces PORT to integer', () => {
    const parsed = envSchema.parse({ PORT: '4000' });
    expect(parsed.PORT).toBe(4000);
  });
});

