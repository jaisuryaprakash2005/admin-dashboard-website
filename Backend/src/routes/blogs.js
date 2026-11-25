const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const requireAdmin = require('../middleware/requireAdmin');

// GET /api/blogs - Public / Website view: get published blogs
router.get('/', async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { status: 'published' };
    const blogs = await Blog.find(filter).sort({ order: 1, createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/admin - Admin view: all blogs
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blogs/:id - Single blog detail
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/blogs/admin - Create new blog
router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { title, image, description, keyfactors, author, category, status } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }
    const blog = await Blog.create({
      title,
      image: image || '',
      description,
      keyfactors: Array.isArray(keyfactors) ? keyfactors : (keyfactors ? [keyfactors] : []),
      author: author || 'ProBridge Admin',
      category: category || 'Real Estate',
      status: status || 'published',
    });
    res.status(201).json({ success: true, result: blog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/blogs/admin/:id - Update blog
router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true, result: blog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/blogs/admin/:id - Delete blog
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
