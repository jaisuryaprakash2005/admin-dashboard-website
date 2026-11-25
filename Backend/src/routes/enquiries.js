const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Property     = require('../models/Property');
const User         = require('../models/User');
const optionalAuth = require('../middleware/optionalAuth');
const { getIsConnected } = require('../config/db');
const { syncUserNotification } = require('../services/userDb');

// Helper to look up property flexibly (ObjectId, rawFormData.id, or string)
async function findProperty(propertyId) {
  if (!propertyId) return null;
  const pid = String(propertyId);
  if (mongoose.Types.ObjectId.isValid(pid)) {
    const p = await Property.findById(pid).populate('owner', 'name email phone').catch(() => null);
    if (p) return p;
  }
  const p = await Property.findOne({
    $or: [
      { 'rawFormData.id': pid },
      { id: pid },
      { _id: pid },
    ],
  }).populate('owner', 'name email phone').catch(() => null);
  return p;
}

// POST /api/enquiries — send enquiry or callback request
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      propertyId,
      name,
      senderName,
      email,
      senderEmail,
      phone,
      mobile,
      senderPhone,
      message,
    } = req.body;

    const finalName = name || senderName || req.user?.name || 'Interested Buyer';
    const finalEmail = email || senderEmail || req.user?.email || '';
    const finalPhone = phone || mobile || senderPhone || req.user?.phone || '';
    const finalMessage = message || (req.body.isCallback ? 'Request callback' : 'Interested in this property');

    if (!finalPhone && !finalEmail && !finalName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least a contact phone number or email.',
      });
    }

    // Try finding property
    const prop = await findProperty(propertyId);

    const propStrId = prop ? (prop._id?.toString() || String(propertyId)) : String(propertyId || '');
    const propTitle = prop?.title || req.body.propertyTitle || 'Property Listing';
    const propImage = (prop?.images && prop.images[0]) || prop?.image || req.body.propertyImage || '';

    // Recipient owner
    let recipientId = null;
    let recipientEmail = '';
    if (prop?.owner) {
      recipientId = typeof prop.owner === 'object' ? prop.owner._id?.toString() : String(prop.owner);
      recipientEmail = (typeof prop.owner === 'object' ? prop.owner.email : '') || prop.ownerEmail || '';
    }

    const isCallback = typeof finalMessage === 'string' && (
      finalMessage.toLowerCase().includes('callback') || finalMessage.toLowerCase().startsWith('request callback')
    );

    const isContactUs =
      req.body.isContactUs === true ||
      req.body.source === 'contact_us' ||
      req.body.type === 'contact_us' ||
      req.body.type === 'contact' ||
      (!propertyId && !req.body.propertyTitle);

    const subject = req.body.subject || (isContactUs ? 'Website Contact Us Inquiry' : '');
    const source = isContactUs ? 'contact_us' : (req.body.source || 'property_page');

    const notifTitle = isContactUs
      ? (subject ? `Contact Us: ${subject}` : `Contact Us Inquiry from ${finalName}`)
      : (isCallback ? `Callback Request: ${propTitle}` : `New Enquiry: ${propTitle}`);

    const notifData = {
      recipient: recipientId || 'admin',
      recipientEmail: recipientEmail || '',
      sender: req.userId ? String(req.userId) : null,
      senderName: finalName,
      senderEmail: finalEmail,
      senderPhone: finalPhone,
      property: propStrId,
      propertyId: propStrId,
      propertyTitle: isContactUs ? (prop?.title || 'ProBridge Website (Contact Us)') : propTitle,
      propertyImage: propImage,
      type: isContactUs ? 'contact_us' : (isCallback ? 'callback' : 'enquiry'),
      source,
      subject,
      isContactUs,
      title: notifTitle,
      message: finalMessage,
      read: false,
    };

    if (getIsConnected()) {
      const created = await Notification.create(notifData);
      console.log(`[Enquiry POST] ✅ Created enquiry lead for "${propTitle}" from ${finalName} (${finalPhone})`);

      if (recipientId) {
        syncUserNotification(recipientId, created).catch(() => {});
      }

      return res.status(201).json({
        success: true,
        message: 'Enquiry sent successfully',
        enquiry: created.toJSON ? created.toJSON() : created,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Enquiry sent successfully (offline mode)',
      enquiry: { ...notifData, id: `enq_${Date.now()}` },
    });
  } catch (err) {
    console.error('[Enquiry POST Error]', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to submit enquiry',
    });
  }
});

// GET /api/enquiries/my — returns current user's or owner's enquiries
router.get('/my', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId ? String(req.userId) : null;
    if (!userId) {
      return res.json({ success: true, count: 0, enquiries: [] });
    }

    const list = await Notification.find({
      $or: [{ recipient: userId }, { sender: userId }],
      type: 'enquiry',
    }).sort({ createdAt: -1 });

    return res.json({ success: true, count: list.length, enquiries: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/enquiries/contact-us or /contact — for submissions from ProBridge website "Contact Us" page
const handleContactUs = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name && !email && !phone) {
      return res.status(400).json({ success: false, message: 'Please provide name and contact details.' });
    }
    const notif = await Notification.create({
      recipient: 'admin',
      recipientEmail: '',
      senderName: name || 'Website Visitor',
      senderEmail: email || '',
      senderPhone: phone || '',
      propertyTitle: 'ProBridge Website (Contact Us)',
      type: 'contact_us',
      source: 'contact_us',
      subject: subject || 'General Website Enquiry',
      isContactUs: true,
      title: subject ? `Contact Us: ${subject}` : `Contact Us Query from ${name || 'Website Visitor'}`,
      message: message || '',
      read: false,
    });
    return res.status(201).json({ success: true, message: 'Contact inquiry received', data: notif });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/contact-us', handleContactUs);
router.post('/contact', handleContactUs);

module.exports = router;
