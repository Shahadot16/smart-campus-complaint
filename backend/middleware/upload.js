const multer = require('multer');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ALLOWED_IMAGE_TYPES } = require('../utils/constants');

// Files are kept in memory until their real type (file signature) is checked;
// only verified images are written to disk by utils/fileStorage.js.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: config.maxFilesPerUpload,
  },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPEG, PNG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

/** Accepts up to N images in the `images` field. */
const uploadImages = upload.array('images', config.maxFilesPerUpload);

module.exports = { uploadImages };
