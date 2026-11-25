const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const cloudinary = require('cloudinary').v2;
const BridgeGuide = require('../models/BridgeGuide');
const requireAdmin = require('../middleware/requireAdmin');

const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

// Helper: extract Cloudinary public_id from raw or upload url
function extractCloudinaryPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/raw\/upload\/(?:s--[^/]+--\/)?(?:v\d+\/)?([^?#]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

// Helper to get authenticated URL for Cloudinary raw assets
function resolveAuthenticatedPdfUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/raw/upload/')) {
    return url;
  }
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId || !cloudName || !apiKey || !apiSecret) {
    return url;
  }
  try {
    return cloudinary.utils.private_download_url(publicId, 'pdf', {
      resource_type: 'raw',
      type: 'upload',
    });
  } catch (e) {
    console.error('Failed to generate Cloudinary private download URL:', e);
    return url;
  }
}

function mapGuideWithAuthUrls(guide, baseUrl) {
  const g = guide.toObject ? guide.toObject() : { ...guide };
  const isCloudinaryRaw = g.pdfUrl && g.pdfUrl.includes('res.cloudinary.com') && g.pdfUrl.includes('/raw/upload/');
  const authUrl = isCloudinaryRaw ? resolveAuthenticatedPdfUrl(g.pdfUrl) : g.pdfUrl;
  const proxyUrl = `${baseUrl}/api/bridge-guides/file/${g._id}`;
  return {
    ...g,
    pdfUrl: authUrl,
    rawPdfUrl: g.pdfUrl,
    fileUrl: proxyUrl,
    downloadUrl: `${proxyUrl}?download=true`,
  };
}

// GET /api/bridge-guides - Public / Website view
router.get('/', async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { status: 'active' };
    const guides = await BridgeGuide.find(filter).sort({ order: 1, createdAt: -1 });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolved = guides.map((g) => mapGuideWithAuthUrls(g, baseUrl));
    res.json(resolved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bridge-guides/admin - Admin view: all guides
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const guides = await BridgeGuide.find().sort({ createdAt: -1 });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const resolved = guides.map((g) => mapGuideWithAuthUrls(g, baseUrl));
    res.json(resolved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bridge-guides/file/:id - Direct PDF stream & download proxy
router.get('/file/:id', async (req, res) => {
  try {
    const guide = await BridgeGuide.findById(req.params.id);
    if (!guide || !guide.pdfUrl) {
      return res.status(404).json({ success: false, error: 'Bridge Guide or PDF not found' });
    }

    const isDownload = req.query.download === 'true';
    const fileName = (guide.fileName || `${guide.title || 'guide'}.pdf`).replace(/[^\w.-]/g, '_');

    // Case 1: Base64 data URI
    if (guide.pdfUrl.startsWith('data:application/pdf;base64,')) {
      const base64Data = guide.pdfUrl.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    // Case 2: Cloudinary Raw URL -> Resolve to authenticated URL
    let targetUrl = guide.pdfUrl;
    if (targetUrl.includes('res.cloudinary.com') && targetUrl.includes('/raw/upload/')) {
      targetUrl = resolveAuthenticatedPdfUrl(targetUrl);
    }

    // Pipe / stream targetUrl to client
    const client = targetUrl.startsWith('https') ? https : http;
    client.get(targetUrl, (streamRes) => {
      if (streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
        const redirectClient = streamRes.headers.location.startsWith('https') ? https : http;
        return redirectClient.get(streamRes.headers.location, (redStreamRes) => {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${fileName}"`);
          if (redStreamRes.headers['content-length']) {
            res.setHeader('Content-Length', redStreamRes.headers['content-length']);
          }
          redStreamRes.pipe(res);
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${fileName}"`);
      if (streamRes.headers['content-length']) {
        res.setHeader('Content-Length', streamRes.headers['content-length']);
      }
      streamRes.pipe(res);
    }).on('error', (err) => {
      console.error('[Stream PDF Error]', err);
      res.redirect(targetUrl);
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bridge-guides/admin - Create new Bridge Guide
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { title, pdfUrl, thumbnail, description, fileName, fileSize, category, status } = req.body;
    if (!title || !pdfUrl || !description) {
      return res.status(400).json({ error: 'Title, PDF URL/upload, and description are required.' });
    }
    const guide = await BridgeGuide.create({
      title,
      pdfUrl,
      thumbnail: thumbnail || '',
      description,
      fileName: fileName || 'document.pdf',
      fileSize: fileSize || '',
      category: category || 'Buyer Handbook',
      status: status || 'active',
    });
    res.status(201).json({ success: true, result: guide });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bridge-guides/admin/:id - Update Bridge Guide
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const guide = await BridgeGuide.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!guide) return res.status(404).json({ error: 'Bridge Guide not found' });
    res.json({ success: true, result: guide });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bridge-guides/admin/:id - Delete Bridge Guide
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const guide = await BridgeGuide.findByIdAndDelete(req.params.id);
    if (!guide) return res.status(404).json({ error: 'Bridge Guide not found' });
    res.json({ success: true, message: 'Bridge Guide deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
