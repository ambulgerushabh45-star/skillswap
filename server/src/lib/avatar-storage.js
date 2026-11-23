import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db/prisma.js';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, '..', '..');
const defaultStorageDir = config.AVATAR_STORAGE_DIR || path.resolve(serverRootDir, '..', 'public', 'uploads', 'avatars');

export class LocalDiskAvatarStorage {
  constructor(customDir) {
    let envDir = process.env.AVATAR_STORAGE_DIR;
    if (envDir && !path.isAbsolute(envDir)) {
      envDir = path.resolve(serverRootDir, envDir);
    }
    this.baseDir = customDir || envDir || defaultStorageDir;
    this.dirEnsured = false;
  }

  async ensureDir() {
    if (!this.dirEnsured) {
      await fs.mkdir(this.baseDir, { recursive: true });
      this.dirEnsured = true;
    }
  }

  resolvePath(fileName) {
    return path.join(this.baseDir, fileName);
  }

  async save(fileName, buffer) {
    await this.ensureDir();
    const filePath = this.resolvePath(fileName);
    await fs.writeFile(filePath, buffer);
  }

  async delete(fileName) {
    const filePath = this.resolvePath(fileName);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async read(fileName) {
    const filePath = this.resolvePath(fileName);
    try {
      return await fs.readFile(filePath);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }
}

export class MongoAvatarStorage {
  constructor(prismaClient = prisma, fallbackToDisk = true) {
    this.prisma = prismaClient;
    this.diskFallback = fallbackToDisk ? new LocalDiskAvatarStorage() : null;
  }

  async save(fileName, buffer, options = {}) {
    const contentType = options.contentType || 'image/webp';
    let userId = options.userId;
    if (!userId) {
      const match = fileName.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[0-9a-f]{16}\.webp$/i);
      userId = match ? match[1] : '';
    }

    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    await this.prisma.avatarFile.upsert({
      where: { id: fileName },
      update: {
        userId,
        contentType,
        size: data.length,
        data,
      },
      create: {
        id: fileName,
        userId,
        contentType,
        size: data.length,
        data,
      },
    });
  }

  async read(fileName) {
    const record = await this.prisma.avatarFile.findUnique({
      where: { id: fileName },
      select: { data: true },
    });
    if (record && record.data) {
      return Buffer.from(record.data);
    }
    if (this.diskFallback) {
      return await this.diskFallback.read(fileName);
    }
    return null;
  }

  async delete(fileName) {
    let deletedMongo = false;
    try {
      await this.prisma.avatarFile.delete({
        where: { id: fileName },
      });
      deletedMongo = true;
    } catch (err) {
      if (err?.code !== 'P2025') {
        throw err;
      }
    }

    let deletedDisk = false;
    if (this.diskFallback) {
      try {
        deletedDisk = await this.diskFallback.delete(fileName);
      } catch {
        // ignore disk cleanup error
      }
    }

    return deletedMongo || deletedDisk;
  }
}

export function createAvatarStorage(strategy = process.env.AVATAR_STORAGE || config.AVATAR_STORAGE || 'mongo') {
  if (strategy === 'disk') {
    return new LocalDiskAvatarStorage();
  }
  return new MongoAvatarStorage();
}

export const avatarStorage = createAvatarStorage();
