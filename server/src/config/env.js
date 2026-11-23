import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, '..', '..');

// Simple .env parser to avoid third-party dotenv dependency
function loadEnvFile() {
  const envPath = path.resolve(serverRootDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile();

const rawEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URL: z.string().refine(
    (url) => url.startsWith('mongodb://') || url.startsWith('mongodb+srv://'),
    { message: 'MONGODB_URL must start with mongodb:// or mongodb+srv://' }
  ),
  JWT_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4000'),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
  RATE_LIMIT_DISABLED: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
  NOMINATIM_USER_AGENT: z.string().default('SkillSwap-App/1.0'),
  AVATAR_STORAGE: z.enum(['mongo', 'disk']).default('mongo'),
  AVATAR_STORAGE_DIR: z.string().optional(),
  PUBLIC_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_DRY_RUN: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
});

const parsed = rawEnvSchema.parse(process.env);

let jwtSecret = parsed.JWT_SECRET;
const isPlaceholder =
  jwtSecret === 'skillswap-super-secret-jwt-key-min-32-chars-long-development' ||
  jwtSecret === 'changeme-min-32-characters-required-for-jwt-secret';

if (parsed.NODE_ENV === 'production') {
  if (!jwtSecret || jwtSecret.length < 32 || isPlaceholder) {
    throw new Error('FATAL: In production, JWT_SECRET must be set, at least 32 characters, and not a placeholder.');
  }
} else {
  if (!jwtSecret || jwtSecret.length < 32) {
    const randomSecret = crypto.randomBytes(32).toString('hex');
    console.warn('\x1b[33m%s\x1b[0m', '[SECURITY WARNING] JWT_SECRET is missing or < 32 chars. Using random per-process development secret.');
    jwtSecret = randomSecret;
  }
}

function extractDatabaseName(mongoUri) {
  try {
    const withoutProtocol = mongoUri.replace(/^mongodb(\+srv)?:\/\//, '');
    const pathPart = withoutProtocol.split('/')[1] || '';
    const dbName = pathPart.split('?')[0];
    return dbName || 'skillswap';
  } catch {
    return 'skillswap';
  }
}

const dbName = extractDatabaseName(parsed.MONGODB_URL);

const resolvedAvatarDir = parsed.AVATAR_STORAGE_DIR
  ? path.resolve(serverRootDir, parsed.AVATAR_STORAGE_DIR)
  : path.resolve(serverRootDir, '..', 'public', 'uploads', 'avatars');

export const config = {
  PORT: parsed.PORT,
  MONGODB_URL: parsed.MONGODB_URL,
  DB_NAME: dbName,
  JWT_SECRET: jwtSecret,
  NODE_ENV: parsed.NODE_ENV,
  ALLOWED_ORIGINS: parsed.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  TRUST_PROXY: Boolean(parsed.TRUST_PROXY),
  RATE_LIMIT_DISABLED: Boolean(parsed.RATE_LIMIT_DISABLED),
  NOMINATIM_USER_AGENT: parsed.NOMINATIM_USER_AGENT,
  AVATAR_STORAGE: parsed.AVATAR_STORAGE,
  AVATAR_STORAGE_DIR: resolvedAvatarDir,
  PUBLIC_URL:
    parsed.PUBLIC_URL ||
    (parsed.NODE_ENV === 'production'
      ? 'https://skillswap.onrender.com'
      : 'http://localhost:5173'),
  GOOGLE_CLIENT_ID: parsed.GOOGLE_CLIENT_ID || null,
  GOOGLE_CLIENT_SECRET: parsed.GOOGLE_CLIENT_SECRET || null,
  GOOGLE_AUTH_URL:
    parsed.NODE_ENV !== 'production' && process.env.GOOGLE_AUTH_URL
      ? process.env.GOOGLE_AUTH_URL
      : 'https://accounts.google.com/o/oauth2/v2/auth',
  GOOGLE_TOKEN_URL:
    parsed.NODE_ENV !== 'production' && process.env.GOOGLE_TOKEN_URL
      ? process.env.GOOGLE_TOKEN_URL
      : 'https://oauth2.googleapis.com/token',
  GOOGLE_USERINFO_URL:
    parsed.NODE_ENV !== 'production' && process.env.GOOGLE_USERINFO_URL
      ? process.env.GOOGLE_USERINFO_URL
      : 'https://openidconnect.googleapis.com/v1/userinfo',
  RESEND_API_KEY: parsed.RESEND_API_KEY || null,
  EMAIL_FROM: parsed.EMAIL_FROM || null,
  EMAIL_DRY_RUN: Boolean(parsed.EMAIL_DRY_RUN),
  RESEND_API_URL:
    parsed.NODE_ENV !== 'production' && process.env.RESEND_API_URL
      ? process.env.RESEND_API_URL
      : 'https://api.resend.com/emails',
  IS_PRODUCTION: parsed.NODE_ENV === 'production',
  IS_TEST: parsed.NODE_ENV === 'test',
};

export default config;
