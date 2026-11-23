import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  detectImageType,
  processAvatar,
  buildAvatarFileName,
  isValidAvatarFileName,
  InvalidImageError,
} from '../lib/avatar.js';
import { avatarStorage } from '../lib/avatar-storage.js';

const router = Router();

// POST /api/user/avatar — Upload and process profile avatar
router.post('/user/avatar', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`avatar:upload:${req.user.id}`, { limit: 10, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > 2.5 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large. Maximum size is 2 MB.' });
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    let formData;
    try {
      const webReq = new Request('http://localhost' + req.originalUrl, {
        method: req.method,
        headers,
        body: buffer,
        duplex: 'half',
      });
      formData = await webReq.formData();
    } catch {
      return sendBadRequest(res, 'Invalid multipart form data');
    }

    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return sendBadRequest(res, 'No file provided');
    }

    if (file.size === 0) {
      return sendBadRequest(res, 'File is empty');
    }

    if (file.size > 2 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large. Maximum size is 2 MB.' });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const imageType = detectImageType(fileBuffer);
    if (!imageType) {
      return res.status(400).json({ error: 'Invalid image format. Only JPEG, PNG, and WebP are allowed.' });
    }

    let processed;
    try {
      processed = await processAvatar(fileBuffer);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return sendBadRequest(res, 'Corrupt or invalid image file');
      }
      return sendInternalError(res, err, 'Failed to process image');
    }

    const newFileName = buildAvatarFileName(req.user.id);

    await avatarStorage.save(newFileName, processed.buffer, {
      contentType: 'image/webp',
      userId: req.user.id,
    });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true },
    });

    const newAvatarUrl = `/api/avatars/${newFileName}`;

    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: newAvatarUrl },
      });
    } catch (dbErr) {
      await avatarStorage.delete(newFileName);
      return sendInternalError(res, dbErr, 'Failed to update avatar in database');
    }

    if (currentUser?.avatarUrl && currentUser.avatarUrl.startsWith('/api/avatars/')) {
      const oldFileName = currentUser.avatarUrl.slice('/api/avatars/'.length);
      if (isValidAvatarFileName(oldFileName) && oldFileName.startsWith(`${req.user.id}-`)) {
        await avatarStorage.delete(oldFileName);
      }
    }

    return res.status(200).json({ avatarUrl: newAvatarUrl });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to upload avatar');
  }
});

// DELETE /api/user/avatar — Remove profile avatar
router.delete('/user/avatar', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`avatar:delete:${req.user.id}`, { limit: 30, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatarUrl: true },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: null },
    });

    if (currentUser?.avatarUrl && currentUser.avatarUrl.startsWith('/api/avatars/')) {
      const oldFileName = currentUser.avatarUrl.slice('/api/avatars/'.length);
      if (isValidAvatarFileName(oldFileName) && oldFileName.startsWith(`${req.user.id}-`)) {
        await avatarStorage.delete(oldFileName);
      }
    }

    return res.status(200).json({ avatarUrl: null });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to remove avatar');
  }
});

// GET /api/avatars/:file — Serve avatar image
router.get('/avatars/:file', requireSession, async (req, res) => {
  try {
    const { file } = req.params;
    if (!file || !isValidAvatarFileName(file)) {
      return sendBadRequest(res, 'Invalid avatar file name');
    }

    const imageBuffer = await avatarStorage.read(file);
    if (!imageBuffer) {
      return sendNotFound(res, 'Avatar not found');
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

    return res.status(200).send(imageBuffer);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to retrieve avatar');
  }
});

export default router;

