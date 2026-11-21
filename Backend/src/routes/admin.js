const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Property = require('../models/Property');
const User = require('../models/User');
const SavedProperty = require('../models/SavedProperty');
const Notification = require('../models/Notification');
const Ad = require('../models/Ad');
const TopBanner = require('../models/TopBanner');
const Builder = require('../models/Builder');
const requireAdmin = require('../middleware/requireAdmin');
const { getIsConnected } = require('../config/db');

// Every route below needs a signed-in admin.
router.use(requireAdmin);

// The admin site works on real data only.
router.use((req, res, next) => {
  if (!getIsConnected()) {
    return res.status(503).json({ success: false, message: 'Database is not connected' });
  }
  next();
});

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const handle = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error('[ADMIN ERROR]', err);
    res.status(500).json({ success: false, message: err.message });
  });

// ─── GET /api/admin/properties?approvalStatus=pending ────────────────────────
// Every property, including pending / admin_approved / approved / rejected / archived ones.
router.get(
  '/properties',
  handle(async (req, res) => {
    const filter = {};
    if (['pending', 'admin_approved', 'approved', 'rejected'].includes(req.query.approvalStatus)) {
      // listings without the field count as approved
      filter.approvalStatus =
        req.query.approvalStatus === 'approved' ? { $nin: ['pending', 'admin_approved', 'rejected'] } : req.query.approvalStatus;
    }
    const list = await Property.find(filter).sort({ createdAt: -1 }).populate('owner', 'name email photo phone');
    res.json({ success: true, count: list.length, results: list.map((p) => p.toJSON()) });
  })
);

// ─── GET /api/admin/properties/archived ──────────────────────────────────────
// Returns all archived properties (status === 'inactive' or 'archived')
router.get(
  '/properties/archived',
  handle(async (req, res) => {
    const list = await Property.find({
      $or: [{ status: 'inactive' }, { status: 'archived' }, { isArchived: true }],
    })
      .sort({ updatedAt: -1 })
      .populate('owner', 'name email photo phone');
    res.json({ success: true, count: list.length, results: list.map((p) => p.toJSON()) });
  })
);

// ─── PATCH /api/admin/properties/:id/archive ─────────────────────────────────
// Toggle archive/restore: sets status to 'inactive' or back to 'active'
router.patch(
  '/properties/:id/archive',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid property id' });

    const prop = await Property.findById(id);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found' });

    const isArchived = prop.status === 'inactive' || prop.status === 'archived' || prop.isArchived === true;
    const updated = await Property.findByIdAndUpdate(
      id,
      { $set: { status: isArchived ? 'active' : 'inactive', isArchived: !isArchived } },
      { new: true }
    ).populate('owner', 'name email photo phone');

    res.json({
      success: true,
      archived: !isArchived,
      result: updated.toJSON(),
    });
  })
);

// ─── PATCH /api/admin/properties/:id/approval ────────────────────────────────
// Body: { action: 'approve' | 'reject', remarks?: string, targetStatus?: string }
router.patch(
  '/properties/:id/approval',
  handle(async (req, res) => {
    const { id } = req.params;
    const { action, targetStatus } = req.body || {};
    const remarks = String((req.body || {}).remarks || '').trim();

    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid property id' });
    if (!['approve', 'reject', 'undo'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'approve', 'reject', or 'undo'" });
    }

    if (action === 'undo') {
      const existing = await Property.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Property not found' });

      // Revert approval/rejection back to pending review and unpublish from mobile app
      const property = await Property.findByIdAndUpdate(
        id,
        {
          $set: {
            approvalStatus: 'pending',
            status: 'under_review',
            rejectionReason: '',
            adminNote: '',
            reviewedAt: null,
            adminApprovedAt: null,
            adminApprovedBy: null,
            adminApprovedByName: '',
            superAdminApprovedAt: null,
            superAdminApprovedBy: null,
            superAdminApprovedByName: '',
          },
        },
        { new: true }
      ).populate('owner', 'name email photo phone');

      const ownerId = property.owner?._id ? String(property.owner._id) : '';
      if (ownerId || property.ownerEmail) {
        Notification.create({
          recipient: ownerId || null,
          recipientEmail: property.ownerEmail || property.owner?.email || '',
          sender: String(req.userId || 'admin'),
          senderName: 'ProBridge Admin',
          property: String(property._id),
          propertyId: String(property._id),
          propertyTitle: property.title,
          propertyImage: property.image || '',
          type: 'system',
          title: 'Listing Reverted to Review',
          message: `“${property.title}” approval was undone and is now back under review.`,
        }).catch((e) => console.error('[ADMIN] notification failed:', e.message));
      }

      console.log(`[ADMIN] Property approval UNDONE: ${id} ("${property.title}") -> moved to pending`);
      return res.json({ success: true, result: property.toJSON ? property.toJSON() : property });
    }

    if (action === 'reject' && !remarks) {
      return res.status(400).json({ success: false, message: 'Rejection remarks are required' });
    }

    const approved = action === 'approve';
    let newStatus = 'rejected';

    // Resolve the approver's display name
    let approverName = req.userName || '';
    if (!approverName && req.userId && getIsConnected()) {
      try {
        const User = require('../models/User');
        const approver = await User.findById(req.userId).select('name').lean();
        if (approver) approverName = approver.name || '';
      } catch {}
    }

    const updateFields = {
      reviewedAt: new Date(),
      rejectionReason: approved ? '' : remarks,
      rejectedBy: approved ? '' : (req.isSuperAdmin ? 'superadmin' : 'admin'),
    };

    if (approved) {
      if (req.isSuperAdmin) {
        // Super Admin approves -> goes LIVE in app ('approved') by default
        newStatus = targetStatus === 'admin_approved' ? 'admin_approved' : 'approved';
        updateFields.superAdminApprovedAt = new Date();
        updateFields.superAdminApprovedBy = req.userId;
        updateFields.superAdminApprovedByName = approverName;
      } else {
        // Regular Admin approves -> goes to 'admin_approved' (waits for Super Admin)
        newStatus = 'admin_approved';
        updateFields.adminApprovedAt = new Date();
        updateFields.adminApprovedBy = req.userId;
        updateFields.adminApprovedByName = approverName;
      }
    }
    updateFields.approvalStatus = newStatus;

    const property = await Property.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    ).populate('owner', 'name email photo phone');
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    // Tell the owner (shows up in the app's notifications).
    const ownerId = property.owner?._id ? String(property.owner._id) : '';
    if (ownerId || property.ownerEmail) {
      const isLive = newStatus === 'approved';
      const isVerified = newStatus === 'admin_approved';
      const title = isLive
        ? 'Property Approved & Published! 🎉'
        : isVerified
        ? 'Admin Verified · Pending Super Admin'
        : 'Your property was not approved';
      const message = isLive
        ? `“${property.title}” has been approved by Super Admin and is now live on the ProBridge app!`
        : isVerified
        ? `“${property.title}” has been verified by the Admin team and forwarded for final Super Admin approval.`
        : `“${property.title}” was not approved by ${req.isSuperAdmin ? 'Super Admin' : 'Admin'}. Reason: ${remarks}`;

      Notification.create({
        recipient: ownerId || null,
        recipientEmail: property.ownerEmail || property.owner?.email || '',
        sender: String(req.userId),
        senderName: req.isSuperAdmin ? 'ProBridge Super Admin' : 'ProBridge Admin',
        property: String(property._id),
        propertyId: String(property._id),
        propertyTitle: property.title,
        propertyImage: property.image || '',
        type: 'system',
        title,
        message,
      }).catch((e) => console.error('[ADMIN] notification failed:', e.message));
    }

    res.json({ success: true, result: property.toJSON() });
  })
);

// Helper to notify user about status change
async function notifyUserStatusChange(user, newStatus, reason = '') {
  try {
    let title = '';
    let message = '';
    if (newStatus === 'flagged') {
      title = '⚠️ Account Warning (Flagged)';
      message = reason || 'Your account has been flagged for suspicious or policy-violating activity. Please adhere to ProBridge guidelines to avoid suspension.';
    } else if (newStatus === 'restricted') {
      title = '🚫 Account Suspended (Restricted)';
      message = reason || 'Your account access has been restricted by administration due to repeated policy violations.';
    } else if (newStatus === 'revoked') {
      title = '⛔ Account Terminated (Revoked)';
      message = reason || 'Your account has been permanently terminated (Revoked) by administration.';
    } else if (newStatus === 'trusted') {
      title = '✅ Account In Good Standing (Trusted)';
      message = reason || 'Your account status has been restored to Trusted. Full access is reinstated.';
    }
    if (title) {
      await Notification.create({
        recipient: user._id ? user._id.toString() : user.id,
        recipientEmail: user.email,
        type: 'system',
        title,
        message,
        read: false,
      });
    }
  } catch (err) {
    console.error('[notifyUserStatusChange Error]', err);
  }
}

// ─── GET /api/admin/users ────────────────────────────────────────────────────
// Password is removed by the User model's toJSON.
router.get(
  '/users',
  handle(async (req, res) => {
    const { q, search } = req.query;
    const term = (q || search || '').trim();
    let query = {};
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query = {
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
        ],
      };
    }
    const list = await User.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: list.length, results: list.map((u) => u.toJSON()) });
  })
);

// ─── PATCH /api/admin/users/:id ──────────────────────────────────────────────
// Admin can update name, phone and reset password for any user (except cannot
// change their own password here — use /api/auth/profile for that).
// Regular admins cannot edit Super Admin accounts — Super Admin only.
router.patch(
  '/users/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid user id' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Block regular admins from editing Super Admin or other Admin accounts
    if (user.role === 'superadmin' && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only a Super Admin can change or edit Super Admin accounts' });
    }
    if (user.role === 'admin' && !req.isSuperAdmin && String(id) !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Only a Super Admin can edit other Admin accounts' });
    }

    const updates = {};
    const { name, phone, password, role, status, statusReason } = req.body || {};

    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof phone === 'string') updates.phone = phone.replace(/[^0-9]/g, '').slice(-10);

    // Super Admin can update user role (cannot change own role)
    if (req.isSuperAdmin && typeof role === 'string' && ['user', 'admin', 'superadmin'].includes(role)) {
      if (String(id) !== String(req.userId)) {
        updates.role = role;
      }
    }

    // Status update (Trusted, Flagged, Restricted, Revoked)
    if (typeof status === 'string') {
      const validStatuses = ['trusted', 'flagged', 'restricted', 'revoked'];
      const normStatus = status.toLowerCase().trim();
      if (validStatuses.includes(normStatus)) {
        // Prevent restricting/revoking self
        if (String(id) !== String(req.userId) || !['restricted', 'revoked'].includes(normStatus)) {
          updates.status = normStatus;
          updates.statusReason = normStatus === 'trusted' ? '' : (typeof statusReason === 'string' && statusReason.trim() ? statusReason.trim() : (req.userName || 'Admin'));
          updates.statusUpdatedAt = new Date();
        }
      }
    } else if (typeof statusReason === 'string') {
      updates.statusReason = statusReason.trim();
    }

    if (typeof password === 'string' && password.length > 0) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      const bcrypt = require('bcryptjs');
      updates.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });

    if (updates.status && (updates.status !== user.status || updates.status === 'flagged')) {
      await notifyUserStatusChange(updated, updates.status, updates.statusReason);
    }

    res.json({ success: true, message: 'User updated', user: updated.toJSON() });
  })
);

// ─── PATCH /api/admin/users/:id/status ──────────────────────────────────────────
router.patch(
  '/users/:id/status',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid user id' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Protect superadmin from status changes unless by themselves or another superadmin
    if (user.role === 'superadmin' && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only a Super Admin can change a Super Admin status' });
    }
    // Cannot self-suspend/revoke
    if (String(id) === String(req.userId) && ['restricted', 'revoked'].includes(req.body?.status)) {
      return res.status(400).json({ success: false, message: 'You cannot restrict or revoke your own admin account' });
    }

    const { status, statusReason } = req.body || {};
    const validStatuses = ['trusted', 'flagged', 'restricted', 'revoked'];
    const normStatus = (status || '').toString().toLowerCase().trim();
    if (!validStatuses.includes(normStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const prevStatus = user.status || 'trusted';
    user.status = normStatus;
    user.statusReason = normStatus === 'trusted' ? '' : (typeof statusReason === 'string' && statusReason.trim() ? statusReason.trim() : (req.userName || 'Admin'));
    user.statusUpdatedAt = new Date();
    await user.save();

    if (prevStatus !== normStatus || normStatus === 'flagged') {
      await notifyUserStatusChange(user, normStatus, user.statusReason);
    }

    res.json({
      success: true,
      message: `User status changed to ${normStatus}`,
      user: user.toJSON(),
    });
  })
);

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
// Removes the account and everything tied to it: their listings, saved items
// (theirs, and other people's saves of their listings) and their notifications.
// The user's dedicated database is dropped only if ADMIN_DROP_USER_DB=true.
// Super Admin can delete users, admins, and other superadmins, but NEVER themselves.
// Regular admins can only delete regular users.
router.delete(
  '/users/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (String(id) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Only Super Admin can delete Admin and Super Admin accounts
    if ((user.role === 'admin' || user.role === 'superadmin') && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only a Super Admin can delete Admin and Super Admin accounts' });
    }

    const owned = await Property.find({ owner: user._id }).select('_id');
    const ownedIds = owned.map((p) => p._id);

    const [props, savedByUser, savedOfTheirs, notes] = await Promise.all([
      Property.deleteMany({ owner: user._id }),
      SavedProperty.deleteMany({ user: user._id }),
      SavedProperty.deleteMany({ property: { $in: ownedIds } }),
      Notification.deleteMany({ $or: [{ recipient: String(user._id) }, ...(user.email ? [{ recipientEmail: user.email }] : [])] }),
    ]);
    await User.deleteOne({ _id: user._id });

    let droppedDb = false;
    if (process.env.ADMIN_DROP_USER_DB === 'true' && user.databaseName && user.databaseName.startsWith('User_')) {
      try {
        await mongoose.connection.useDb(user.databaseName, { useCache: true }).dropDatabase();
        droppedDb = true;
      } catch (e) {
        console.error('[ADMIN] could not drop user database:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'User removed',
      removed: {
        properties: props.deletedCount,
        saved: savedByUser.deletedCount + savedOfTheirs.deletedCount,
        notifications: notes.deletedCount,
        userDatabaseDropped: droppedDb,
      },
    });
  })
);

// ─── GET /api/admin/leads (All property enquiries & leads) ───────────────────
router.get(
  '/leads',
  handle(async (req, res) => {
    const enquiries = await Notification.find({ type: { $in: ['enquiry', 'callback'] } }).sort({ createdAt: -1 });

    const propertyIds = [...new Set(enquiries.map((e) => e.propertyId || e.property).filter(Boolean))];
    const properties = await Property.find({
      $or: [
        { _id: { $in: propertyIds.filter(validId) } },
        { 'rawFormData.id': { $in: propertyIds } },
      ],
    }).populate('owner', 'name email phone');

    const propMap = new Map();
    for (const p of properties) {
      const sanitized = p.toJSON ? p.toJSON() : { ...p };
      sanitized.id = p._id.toString();
      propMap.set(p._id.toString(), sanitized);
      if (p.rawFormData?.id) propMap.set(String(p.rawFormData.id), sanitized);
    }

    const senderIds = [...new Set(enquiries.map((e) => e.sender).filter(Boolean))];
    const senderEmails = [...new Set(enquiries.map((e) => e.senderEmail).filter(Boolean))];
    const users = await User.find({
      $or: [
        { _id: { $in: senderIds.filter(validId) } },
        { email: { $in: senderEmails } },
      ],
    });

    const userMap = new Map();
    for (const u of users) {
      userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.toLowerCase(), u);
    }

    const userEnquiryCount = new Map();
    for (const e of enquiries) {
      const key = e.sender || (e.senderEmail ? e.senderEmail.toLowerCase() : null) || 'unknown';
      userEnquiryCount.set(key, (userEnquiryCount.get(key) || 0) + 1);
    }

    const results = enquiries.map((e) => {
      const p = propMap.get(String(e.propertyId)) || propMap.get(String(e.property)) || null;
      const u = (e.sender && userMap.get(String(e.sender))) ||
                (e.senderEmail && userMap.get(e.senderEmail.toLowerCase())) ||
                null;

      const userKey = e.sender || (e.senderEmail ? e.senderEmail.toLowerCase() : null) || 'unknown';
      const userTotal = userEnquiryCount.get(userKey) || 1;
      const isCallback = (e.title && e.title.toLowerCase().includes('callback')) || (e.message && e.message.toLowerCase().includes('callback')) || e.type === 'callback';

      return {
        id: e._id.toString(),
        type: e.type,
        status: e.status || 'New',
        title: e.title,
        message: e.message,
        comment: e.message,
        read: e.read,
        createdAt: e.createdAt,

        senderId: e.sender || u?._id?.toString() || null,
        senderName: u?.name || e.senderName || 'Interested Buyer',
        senderEmail: u?.email || e.senderEmail || '',
        senderPhone: u?.phone || e.senderPhone || '',
        senderPhoto: u?.photo || '',
        userTotalEnquiries: userTotal,
        isCallback,
        requestType: isCallback ? 'Request Callback' : 'Property Enquiry',

        propertyId: e.propertyId || e.property,
        propertyTitle: p?.title || e.propertyTitle || 'Property Listing',
        propertyImage: (p?.images && p.images[0]) || p?.image || e.propertyImage || '',
        propertyPrice: p?.price || 'Price on request',
        propertyLocation: p?.location || p?.city || '',
        city: p?.city || '',
        listingType: p?.listingType || 'Sell',
        propertyType: p?.propertyType || 'Apartment',
        views: typeof p?.views === 'number' ? p.views : 0,

        ownerName: p?.ownerName || (typeof p?.owner === 'object' ? p?.owner?.name : '') || '',
        ownerEmail: p?.ownerEmail || (typeof p?.owner === 'object' ? p?.owner?.email : '') || '',
        ownerPhone: p?.ownerPhone || p?.phone || (typeof p?.owner === 'object' ? p?.owner?.phone : '') || '',
      };
    });

    const totalViewsAgg = await Property.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);
    const totalViews = totalViewsAgg[0]?.totalViews || 0;

    const uniqueUsers = new Set(
      enquiries.map((e) => e.sender || (e.senderEmail ? e.senderEmail.toLowerCase() : null)).filter(Boolean)
    ).size;

    const propLeadCounts = {};
    for (const e of enquiries) {
      const pid = String(e.propertyId || e.property || '');
      if (pid) propLeadCounts[pid] = (propLeadCounts[pid] || 0) + 1;
    }
    const mostEnquiredProperties = Object.entries(propLeadCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, count]) => {
        const p = propMap.get(pid);
        return {
          propertyId: pid,
          title: p?.title || 'Property',
          image: p?.image || (p?.images && p.images[0]) || '',
          price: p?.price || '',
          enquiryCount: count,
          views: p?.views || 0,
        };
      });

    res.json({
      success: true,
      count: results.length,
      stats: {
        totalLeads: results.length,
        uniqueUsers,
        totalViews,
        mostEnquiredProperties,
      },
      results,
    });
  })
);

// ─── GET /api/admin/leads/users (Grouped leads per user) ─────────────────────
router.get(
  '/leads/users',
  handle(async (req, res) => {
    const enquiries = await Notification.find({ type: 'enquiry' }).sort({ createdAt: -1 });

    const propertyIds = [...new Set(enquiries.map((e) => e.propertyId || e.property).filter(Boolean))];
    const properties = await Property.find({
      $or: [
        { _id: { $in: propertyIds.filter(validId) } },
        { 'rawFormData.id': { $in: propertyIds } },
      ],
    });
    const propMap = new Map();
    for (const p of properties) {
      const s = p.toJSON ? p.toJSON() : { ...p };
      s.id = p._id.toString();
      propMap.set(p._id.toString(), s);
      if (p.rawFormData?.id) propMap.set(String(p.rawFormData.id), s);
    }

    const senderIds = [...new Set(enquiries.map((e) => e.sender).filter(Boolean))];
    const senderEmails = [...new Set(enquiries.map((e) => e.senderEmail).filter(Boolean))];
    const users = await User.find({
      $or: [
        { _id: { $in: senderIds.filter(validId) } },
        { email: { $in: senderEmails } },
      ],
    });
    const userMap = new Map();
    for (const u of users) {
      userMap.set(u._id.toString(), u);
      if (u.email) userMap.set(u.email.toLowerCase(), u);
    }

    const groups = new Map();
    for (const e of enquiries) {
      const key = e.sender || (e.senderEmail ? e.senderEmail.toLowerCase() : null) || 'anonymous';
      if (!groups.has(key)) {
        const u = (e.sender && userMap.get(String(e.sender))) ||
                  (e.senderEmail && userMap.get(e.senderEmail.toLowerCase())) ||
                  null;
        groups.set(key, {
          userId: u?._id?.toString() || e.sender || null,
          name: u?.name || e.senderName || 'Interested Buyer',
          email: u?.email || e.senderEmail || '',
          phone: u?.phone || e.senderPhone || '',
          photo: u?.photo || '',
          totalEnquiries: 0,
          lastEnquiryAt: e.createdAt,
          enquiries: [],
        });
      }

      const g = groups.get(key);
      g.totalEnquiries += 1;
      const p = propMap.get(String(e.propertyId)) || propMap.get(String(e.property));
      g.enquiries.push({
        id: e._id.toString(),
        propertyId: e.propertyId || e.property,
        propertyTitle: p?.title || e.propertyTitle || 'Property Listing',
        propertyImage: (p?.images && p.images[0]) || p?.image || e.propertyImage || '',
        propertyPrice: p?.price || '',
        city: p?.city || '',
        listingType: p?.listingType || 'Sell',
        views: typeof p?.views === 'number' ? p.views : 0,
        message: e.message,
        createdAt: e.createdAt,
      });
    }

    const results = Array.from(groups.values()).sort((a, b) => b.totalEnquiries - a.totalEnquiries);
    res.json({ success: true, count: results.length, results });
  })
);

// ─── PATCH /api/admin/leads/:id/status ─────────────────────────────────────
const LEAD_STATUSES = [
  'New',
  'Contact Pending',
  'Contacted',
  'Follow-up',
  'In Progress',
  'Converted',
  'Lost',
  'Closed',
];

router.patch(
  '/leads/:id/status',
  handle(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!LEAD_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${LEAD_STATUSES.join(', ')}`,
      });
    }

    const query = validId(id) ? { _id: id } : { _id: id };
    const updated = await Notification.findOneAndUpdate(
      query,
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({
      success: true,
      message: `Lead status updated to ${status}`,
      lead: updated,
    });
  })
);

// ─── DELETE /api/admin/leads/:id (Super Admin Only) ─────────────────────────
router.delete(
  '/leads/:id',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { id } = req.params;
    if (validId(id)) {
      await Notification.findByIdAndDelete(id);
    } else {
      await Notification.deleteOne({ _id: id });
    }
    res.json({ success: true, message: 'Enquiry lead deleted' });
  })
);

// ─── DELETE /api/admin/leads/user/:userKey (Super Admin Only) ───────────────
router.delete(
  '/leads/user/:userKey',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { userKey } = req.params;
    const decodedKey = decodeURIComponent(userKey);
    await Notification.deleteMany({
      type: 'enquiry',
      $or: [
        { sender: decodedKey },
        { senderEmail: decodedKey.toLowerCase() },
        ...(validId(decodedKey) ? [{ sender: decodedKey }] : []),
      ],
    });
    res.json({ success: true, message: 'User enquiry history deleted' });
  })
);

// ─── Super Admin Only: Admin Management ─────────────────────────────────────

function requireSuperAdminRole(req, res, next) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ success: false, message: 'Super Admin access only' });
  }
  next();
}

// GET /api/admin/admins — list all admins & superadmins
router.get(
  '/admins',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const list = await User.find({ role: { $in: ['admin', 'superadmin'] } }).sort({ createdAt: -1 });
    res.json({ success: true, count: list.length, results: list.map((u) => u.toJSON()) });
  })
);

// POST /api/admin/admins — create new admin or new superadmin
router.post(
  '/admins',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { name, email, password, phone, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }
    const targetRole = role === 'superadmin' ? 'superadmin' : 'admin';
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password: hashedPassword,
      phone: phone ? String(phone).replace(/\D/g, '').slice(-10) : '',
      role: targetRole,
      provider: 'email',
    });
    res.status(201).json({
      success: true,
      message: `${targetRole === 'superadmin' ? 'Super Admin' : 'Admin'} account created successfully`,
      result: newAdmin.toJSON(),
    });
  })
);

// PATCH /api/admin/admins/:id — update admin details
router.patch(
  '/admins/:id',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid admin id' });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin not found' });

    const updates = {};
    const { name, phone, password, role } = req.body || {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof phone === 'string') updates.phone = phone.replace(/\D/g, '').slice(-10);
    if (typeof password === 'string' && password.length >= 6) {
      const bcrypt = require('bcryptjs');
      updates.password = await bcrypt.hash(password, 10);
    }
    if (role && ['admin', 'superadmin'].includes(role)) {
      if (String(id) !== String(req.userId)) {
        updates.role = role;
      }
    }

    const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });
    res.json({ success: true, message: 'Admin updated', result: updated.toJSON() });
  })
);

// DELETE /api/admin/admins/:id — demote to user (or permanent delete)
router.delete(
  '/admins/:id',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid admin id' });
    if (String(id) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'Cannot demote or delete your own account' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin not found' });

    const permanent = req.query.deletePermanently === 'true';
    if (permanent) {
      await User.deleteOne({ _id: id });
      return res.json({ success: true, message: 'Account permanently deleted' });
    }

    user.role = 'user';
    await user.save();
    res.json({ success: true, message: 'Account demoted to regular user', result: user.toJSON() });
  })
);

// PATCH /api/admin/users/:id/role — change user role (super admin only)
router.patch(
  '/users/:id/role',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body || {};
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be 'user', 'admin', or 'superadmin'" });
    }
    if (String(id) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'Cannot modify your own role' });
    }
    const user = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: `Role updated to ${role}`, result: user.toJSON() });
  })
);

// ─── Ads Management Endpoints ───────────────────────────────────────────────

// GET /api/admin/ads — list all ads (history)
router.get(
  '/ads',
  handle(async (req, res) => {
    const list = await Ad.find({})
      .sort({ createdAt: -1 })
      .populate('property', 'title price location image city locality buildingType listingType propertyType ownerName');
    res.json({ success: true, count: list.length, results: list });
  })
);

// POST /api/admin/ads — create new ad (sent for Super Admin approval)
router.post(
  '/ads',
  handle(async (req, res) => {
    const { title, image, property, startDate, endDate } = req.body || {};
    if (!title || !image || !property || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, banner image, linked property, start date, and end date are all required',
      });
    }

    if (!validId(property)) {
      return res.status(400).json({ success: false, message: 'Invalid property ID' });
    }
    const propExists = await Property.findById(property);
    if (!propExists) {
      return res.status(404).json({ success: false, message: 'Selected property does not exist' });
    }

    const creator = req.userId ? await User.findById(req.userId) : null;
    const createdByName = creator?.name || req.userName || 'Admin';
    const createdByEmail = creator?.email || req.userEmail || '';

    const newAd = await Ad.create({
      title: title.trim(),
      image: image.trim(),
      property,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'pending_approval',
      createdBy: req.userId || null,
      createdByName,
      createdByEmail,
    });

    const populated = await Ad.findById(newAd._id).populate(
      'property',
      'title price location image city locality buildingType listingType propertyType'
    );
    res.status(201).json({
      success: true,
      message: 'Ad submitted for Super Admin approval successfully',
      result: populated,
    });
  })
);

// PATCH /api/admin/ads/:id/publish — Super Admin approves & publishes ad
router.patch(
  '/ads/:id/publish',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid ad ID' });
    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    const approver = req.userId ? await User.findById(req.userId) : null;
    ad.status = 'published';
    ad.approvedBy = req.userId || null;
    ad.approvedByName = approver?.name || 'Super Admin';
    ad.publishedAt = new Date();
    await ad.save();

    const populated = await Ad.findById(ad._id).populate(
      'property',
      'title price location image city locality buildingType listingType propertyType'
    );
    res.json({
      success: true,
      message: 'Ad approved and published live to the app!',
      result: populated,
    });
  })
);

// PATCH /api/admin/ads/:id/reject — Super Admin rejects ad
router.patch(
  '/ads/:id/reject',
  requireSuperAdminRole,
  handle(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid ad ID' });
    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    ad.status = 'rejected';
    ad.rejectionReason = reason || 'Rejected by Super Admin';
    await ad.save();

    res.json({ success: true, message: 'Ad rejected', result: ad });
  })
);

// DELETE /api/admin/ads/:id — Delete ad
router.delete(
  '/ads/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid ad ID' });
    await Ad.findByIdAndDelete(id);
    res.json({ success: true, message: 'Ad deleted successfully' });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// TOP BANNERS (Standalone Website Search Bar Banners — NOT connected to Ads)
// ═════════════════════════════════════════════════════════════════════════════

// PATCH /api/admin/ads/:id/top-banner — Update top banner image and status for an ad
router.patch(
  '/ads/:id/top-banner',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid ad ID' });
    const ad = await Ad.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    const { topBanner, isTopBanner } = req.body || {};
    if (topBanner !== undefined) {
      ad.topBanner = String(topBanner).trim();
      ad.isTopBanner = isTopBanner !== undefined ? Boolean(isTopBanner) : Boolean(ad.topBanner);
    } else if (isTopBanner !== undefined) {
      ad.isTopBanner = Boolean(isTopBanner);
    }
    await ad.save();

    const populated = await Ad.findById(ad._id).populate(
      'property',
      'title price location image city locality buildingType listingType propertyType'
    );
    res.json({
      success: true,
      message: 'Top banner updated successfully',
      result: populated,
    });
  })
);

// GET /api/admin/top-banners — list all standalone top banners
router.get(
  '/top-banners',
  handle(async (req, res) => {
    const list = await TopBanner.find({})
      .sort({ order: 1, createdAt: -1 })
      .populate('property', 'title price location image city locality buildingType');
    res.json({ success: true, count: list.length, results: list });
  })
);

// POST /api/admin/top-banners — create standalone top banner
router.post(
  '/top-banners',
  handle(async (req, res) => {
    const { title, subtitle, image, link, property, isActive, order, aspectRatio } = req.body || {};
    if (!image) {
      return res.status(400).json({ success: false, message: 'Top banner image is required' });
    }

    const creator = req.userId ? await User.findById(req.userId) : null;
    const banner = await TopBanner.create({
      title: (title || '').trim(),
      subtitle: (subtitle || '').trim(),
      image: image.trim(),
      link: (link || '').trim(),
      property: property && validId(property) ? property : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      aspectRatio: aspectRatio ? Number(aspectRatio) : 4.0,
      order: order ? Number(order) : 0,
      createdByName: creator?.name || req.userName || 'Admin',
    });

    const populated = await TopBanner.findById(banner._id).populate('property', 'title price location image city locality');
    res.status(201).json({ success: true, message: 'Top banner created successfully', result: populated });
  })
);

// PATCH /api/admin/top-banners/:id — update standalone top banner
router.patch(
  '/top-banners/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid banner ID' });

    const updates = {};
    const { title, subtitle, image, link, property, isActive, order, aspectRatio } = req.body || {};
    if (title !== undefined) updates.title = title.trim();
    if (subtitle !== undefined) updates.subtitle = subtitle.trim();
    if (image !== undefined) updates.image = image.trim();
    if (link !== undefined) updates.link = link.trim();
    if (property !== undefined) updates.property = property && validId(property) ? property : null;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (order !== undefined) updates.order = Number(order);
    if (aspectRatio !== undefined) updates.aspectRatio = Number(aspectRatio);

    const banner = await TopBanner.findByIdAndUpdate(id, updates, { new: true })
      .populate('property', 'title price location image city locality');
    if (!banner) return res.status(404).json({ success: false, message: 'Top banner not found' });

    res.json({ success: true, message: 'Top banner updated', result: banner });
  })
);

// DELETE /api/admin/top-banners/:id — delete standalone top banner
router.delete(
  '/top-banners/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ success: false, message: 'Invalid banner ID' });
    await TopBanner.findByIdAndDelete(id);
    res.json({ success: true, message: 'Top banner deleted successfully' });
  })
);

// ─── BUILDERS & DEVELOPERS MANAGEMENT ─────────────────────────────
// GET /api/admin/builders — list all builders
router.get(
  '/builders',
  handle(async (req, res) => {
    let count = await Builder.countDocuments();
    if (count === 0) {
      try {
        await Builder.insertMany([
          {
            name: 'Brigade Group',
            logo: 'https://im.proptiger.com/3/100376/13/brigade-9778458.jpeg?height=120&width=320',
            experience: '35+ Years',
            established: '1986',
            headquarters: 'Bengaluru',
            order: 1,
            status: 'active',
          },
          {
            name: 'Puravankara Limited',
            logo: 'https://im.proptiger.com/3/100046/13/puravankara-4491843.jpeg?height=120&width=320',
            experience: '45+ Years',
            established: '1975',
            headquarters: 'Bengaluru',
            order: 2,
            status: 'active',
          },
          {
            name: 'Godrej Properties',
            logo: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=320&q=80',
            experience: '32+ Years',
            established: '1990',
            headquarters: 'Mumbai',
            order: 3,
            status: 'active',
          },
          {
            name: 'Prestige Group',
            logo: 'https://im.proptiger.com/3/365/13/prestige-183425.jpg?height=120&width=320',
            experience: '36+ Years',
            established: '1986',
            headquarters: 'Bengaluru',
            order: 4,
            status: 'active',
          },
        ]);
      } catch (seedErr) {
        console.warn('[Builders Seed Warning]', seedErr.message);
      }
    }

    const builders = await Builder.find({}).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, count: builders.length, results: builders });
  })
);

// POST /api/admin/builders — create a new builder
router.post(
  '/builders',
  handle(async (req, res) => {
    const { name, logo, experience, established, headquarters, description, website, status, order } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Builder name is required' });
    }
    if (!logo || !logo.trim()) {
      return res.status(400).json({ success: false, message: 'Builder logo is required' });
    }

    const trimmedName = name.trim();
    const allBuilders = await Builder.find({});
    const duplicate = allBuilders.find(b => b.name && b.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'A builder with this name already exists' });
    }

    const creator = req.userId ? await User.findById(req.userId) : null;
    const builder = await Builder.create({
      name: trimmedName,
      logo: logo.trim(),
      experience: (experience || '').trim(),
      established: (established || '').trim(),
      headquarters: (headquarters || '').trim(),
      description: (description || '').trim(),
      website: (website || '').trim(),
      status: status === 'inactive' ? 'inactive' : 'active',
      order: order !== undefined ? Number(order) : 0,
      createdByName: creator?.name || req.userName || 'Admin',
    });

    res.status(201).json({ success: true, message: 'Builder created successfully', result: builder });
  })
);

// PATCH /api/admin/builders/:id — update a builder
router.patch(
  '/builders/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    const query = validId(id) ? { _id: id } : { name: id };

    const updates = {};
    const { name, logo, experience, established, headquarters, description, website, status, order } = req.body || {};
    if (name !== undefined) updates.name = name.trim();
    if (logo !== undefined) updates.logo = logo.trim();
    if (experience !== undefined) updates.experience = experience.trim();
    if (established !== undefined) updates.established = established.trim();
    if (headquarters !== undefined) updates.headquarters = headquarters.trim();
    if (description !== undefined) updates.description = description.trim();
    if (website !== undefined) updates.website = website.trim();
    if (status !== undefined) updates.status = status;
    if (order !== undefined) updates.order = Number(order);

    const builder = await Builder.findOneAndUpdate(query, updates, { new: true, runValidators: true });
    if (!builder) return res.status(404).json({ success: false, message: 'Builder not found' });

    res.json({ success: true, message: 'Builder updated successfully', result: builder });
  })
);

// PATCH /api/admin/builders/:id/status — toggle active/inactive status
router.patch(
  '/builders/:id/status',
  handle(async (req, res) => {
    const { id } = req.params;
    const query = validId(id) ? { _id: id } : { name: id };

    const builder = await Builder.findOne(query);
    if (!builder) return res.status(404).json({ success: false, message: 'Builder not found' });

    const updatedStatus = req.body?.status || (builder.status === 'active' ? 'inactive' : 'active');
    builder.status = updatedStatus;
    await builder.save();

    res.json({ success: true, message: 'Builder status changed to ' + updatedStatus, result: builder });
  })
);

// DELETE /api/admin/builders/:id — delete a builder
router.delete(
  '/builders/:id',
  handle(async (req, res) => {
    const { id } = req.params;
    const query = validId(id) ? { _id: id } : { name: id };

    const deleted = await Builder.findOneAndDelete(query);
    if (!deleted) return res.status(404).json({ success: false, message: 'Builder not found' });

    res.json({ success: true, message: 'Builder deleted successfully' });
  })
);

module.exports = router;
