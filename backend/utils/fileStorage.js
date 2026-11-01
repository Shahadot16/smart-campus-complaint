const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config/env');
const { Attachment } = require('../models');
const ApiError = require('./ApiError');

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Detects the real image type from the file's magic bytes. */
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  const header = buffer.subarray(0, 6).toString('ascii');
  if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Throws if any uploaded file is not a genuine image of its declared type. */
function verifyImages(files = []) {
  for (const file of files) {
    const actual = detectImageType(file.buffer);
    if (!actual || actual !== file.mimetype) {
      throw ApiError.badRequest(`"${file.originalname}" is not a valid image file`);
    }
  }
}

/**
 * Writes verified images to local storage and creates Attachment records.
 * Files are removed again if the database write fails.
 */
async function saveImages(files, { complaintId, userId, purpose = 'evidence', session = null }) {
  if (!files?.length) return [];
  verifyImages(files);
  await fs.mkdir(config.uploadDir, { recursive: true });

  const docs = [];
  const written = [];
  try {
    for (const file of files) {
      const _id = new mongoose.Types.ObjectId();
      const storageKey = `${crypto.randomBytes(16).toString('hex')}.${EXTENSIONS[file.mimetype]}`;
      await fs.writeFile(path.join(config.uploadDir, storageKey), file.buffer);
      written.push(storageKey);
      docs.push({
        _id,
        complaint: complaintId,
        fileUrl: `/api/attachments/${_id}/file`,
        storageKey,
        originalName: path.basename(file.originalname).slice(0, 200),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: userId,
        purpose,
      });
    }
    return await Attachment.insertMany(docs, { session });
  } catch (err) {
    await Promise.all(written.map((key) => removeFile(key)));
    throw err;
  }
}

async function removeFile(storageKey) {
  try {
    await fs.unlink(path.join(config.uploadDir, path.basename(storageKey)));
  } catch {
    /* already gone */
  }
}

function filePath(storageKey) {
  return path.join(config.uploadDir, path.basename(storageKey));
}

module.exports = { detectImageType, verifyImages, saveImages, removeFile, filePath };
