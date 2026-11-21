const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const requireAuth = require('../middleware/requireAuth');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

// ─── Cloudinary Config ────────────────────────────────────────────────────────
const cloudName  = (process.env.CLOUDINARY_CLOUD_NAME  || '').trim();
const apiKey     = (process.env.CLOUDINARY_API_KEY     || '').trim();
const apiSecret  = (process.env.CLOUDINARY_API_SECRET  || '').trim();

const isCloudinaryConfigured =
  Boolean(cloudName && apiKey && apiSecret &&
    cloudName  !== 'CLOUDINARY_CLOUD_NAME' &&
    apiKey     !== 'CLOUDINARY_API_KEY');

if (isCloudinaryConfigured) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  console.log('[Upload] Cloudinary configured ✅');
} else {
  console.warn('[Upload] Cloudinary NOT configured — will use base64 fallback');
}

// ─── Multer — memory storage ──────────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const handleMultipartOrJson = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('image')(req, res, next);
  } else {
    next();
  }
};

// ─── Helper: upload buffer to Cloudinary ─────────────────────────────────────
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// ─── POST /api/upload/image ───────────────────────────────────────────────────
// Accepts JSON: { base64: "...", type: "property"|"profile" }
// or multipart form with field "image"
router.post('/image', optionalAuth, handleMultipartOrJson, async (req, res) => {
  try {
    let buffer = null;
    let mimeType = 'image/jpeg';
    const type = req.body?.type || 'profile';
    const folder = type === 'profile' ? 'probridge/profiles' : 'probridge/properties';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/jpeg';
    } else if (req.body?.base64) {
      let b64 = req.body.base64;
      const match = b64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) { mimeType = match[1]; b64 = match[2]; }
      buffer = Buffer.from(b64, 'base64');
    }

    if (!buffer) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    if (isCloudinaryConfigured) {
      try {
        const uploadOptions = {
          folder,
          resource_type: 'image',
          transformation: type === 'profile'
            ? [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
            : [{ width: 1200, height: 900, crop: 'limit', quality: 'auto:good' }],
        };
        const result = await uploadToCloudinary(buffer, uploadOptions);
        return res.json({ success: true, url: result.secure_url, public_id: result.public_id });
      } catch (cloudErr) {
        console.warn('[Cloudinary Upload Warning]', cloudErr.message, '— falling back to base64.');
      }
    }

    // Fallback: return base64 Data URI
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return res.json({ success: true, url: dataUri, public_id: null, fallback: true });
  } catch (err) {
    console.error('[Upload Error]', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// ─── POST /api/upload/delete ──────────────────────────────────────────────────
router.post('/delete', requireAuth, async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ success: false, message: 'public_id is required' });
    if (isCloudinaryConfigured) await cloudinary.uploader.destroy(public_id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/upload/pdf ───────────────────────────────────────────────────
const uploadPdf = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter(req, file, cb) {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.post('/pdf', optionalAuth, (req, res, next) => {
  uploadPdf.single('brochure')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    let buffer = null;
    let fileName = 'brochure.pdf';

    if (req.file) {
      buffer = req.file.buffer;
      fileName = req.file.originalname || 'brochure.pdf';
    } else if (req.body?.base64) {
      let b64 = req.body.base64;
      const match = b64.match(/^data:application\/pdf;base64,(.+)$/);
      if (match) b64 = match[1];
      buffer = Buffer.from(b64, 'base64');
    }

    if (!buffer) {
      return res.status(400).json({ success: false, message: 'No PDF file provided' });
    }

    if (isCloudinaryConfigured) {
      try {
        const uploadOptions = {
          folder: 'probridge/brochures',
          resource_type: 'raw',
          public_id: `${Date.now()}-${fileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        };
        const result = await uploadToCloudinary(buffer, uploadOptions);
        return res.json({
          success: true,
          url: result.secure_url,
          fileName,
        });
      } catch (cloudErr) {
        console.warn('[Cloudinary PDF Warning]', cloudErr.message, 'Falling back to Base64 URI.');
      }
    }

    const base64Data = buffer.toString('base64');
    const dataUri = `data:application/pdf;base64,${base64Data}`;
    return res.json({
      success: true,
      url: dataUri,
      fileName,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

