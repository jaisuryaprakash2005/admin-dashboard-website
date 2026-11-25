const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Blog description/content is required'],
      trim: true,
    },
    keyfactors: {
      type: [String],
      default: [],
    },
    author: {
      type: String,
      default: 'ProBridge Admin',
      trim: true,
    },
    category: {
      type: String,
      default: 'Real Estate',
      trim: true,
    },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blog', blogSchema);
