const express = require('express');
const router = express.Router();
const YoutubeLink = require('../models/YoutubeLink');
const requireAdmin = require('../middleware/requireAdmin');

// GET /api/youtube-links - Public / Website view: get active links
router.get('/', async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { status: 'active' };
    const links = await YoutubeLink.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/youtube-links/admin - Admin view: all links
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const links = await YoutubeLink.find().sort({ createdAt: -1 });
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/youtube-links/admin - Create new YouTube link
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { title, youtubeUrl, description, category, status } = req.body;
    if (!title || !youtubeUrl || !description) {
      return res.status(400).json({ error: 'Title, YouTube URL, and description are required.' });
    }
    const link = await YoutubeLink.create({
      title,
      youtubeUrl,
      description,
      category: category || 'General',
      status: status || 'active',
    });
    res.status(201).json({ success: true, result: link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/youtube-links/admin/:id - Update YouTube link
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const link = await YoutubeLink.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!link) return res.status(404).json({ error: 'YouTube link not found' });
    res.json({ success: true, result: link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/youtube-links/admin/:id - Delete YouTube link
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const link = await YoutubeLink.findByIdAndDelete(req.params.id);
    if (!link) return res.status(404).json({ error: 'YouTube link not found' });
    res.json({ success: true, message: 'YouTube link deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
