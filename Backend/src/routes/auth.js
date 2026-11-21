const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const requireAuth = require('../middleware/requireAuth');
const optionalAuth = require('../middleware/optionalAuth');
const User = require('../models/User');
const { getIsConnected } = require('../config/db');
const { createUserDatabase } = require('../services/userDb');
const {
  sendFirebaseVerificationCode,
  verifyFirebaseOtpCode,
} = require('../services/firebaseAuth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// In-memory fallback if MongoDB is not connected
const MEMORY_USERS = [];

async function ensureSuperAdminUser() {
  const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
  const superPass = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026';
  const superName = (process.env.SUPERADMIN_NAME || 'Super Admin').trim();

  let user = await User.findOne({ email: superEmail });
  if (!user) {
    const hashedPassword = await bcrypt.hash(superPass, 10);
    user = await User.create({
      name: superName,
      email: superEmail,
      password: hashedPassword,
      role: 'superadmin',
      phone: '9999999999',
      phoneVerified: true,
      provider: 'email',
    });
    console.log(`👑 [Super Admin] Seeded default superadmin account: ${superEmail}`);
  } else {
    let needsSave = false;
    if (user.role !== 'superadmin') {
      user.role = 'superadmin';
      needsSave = true;
    }
    const matches = await bcrypt.compare(superPass, user.password || '');
    if (!matches) {
      user.password = await bcrypt.hash(superPass, 10);
      needsSave = true;
      console.log(`👑 [Super Admin] Updated password from .env for: ${superEmail}`);
    }
    if (needsSave) await user.save();
  }
  return user;
}

function generateToken(userId, email, name, role = 'user') {
  return jwt.sign(
    { sub: userId, email, name, role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function sanitizeUser(user) {
  if (!user) return null;
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.__v;
  if (obj._id) obj.id = obj._id.toString();
  if (!obj.status) obj.status = 'trusted';
  return obj;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. MongoDB Mode
    if (getIsConnected()) {
      const existing = await User.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        provider: 'email',
      });

      // Automatically create dedicated user database with 'properties' and 'saved' collections
      await createUserDatabase(user);

      const token = generateToken(user._id.toString(), user.email, user.name);
      return res.status(201).json({ success: true, token, user: sanitizeUser(user) });
    }

    // 2. In-Memory Fallback
    const existingMem = MEMORY_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingMem) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    MEMORY_USERS.push(newUser);
    const token = generateToken(newUser.id, newUser.email, newUser.name);
    return res.status(201).json({ success: true, token, user: sanitizeUser(newUser) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    let cleanEmail = String(email).trim().toLowerCase();
    let rawPassword = String(password).trim();

    const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
    const superPass = (process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026').trim();
    const superName = (process.env.SUPERADMIN_NAME || 'Super Admin').trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@probridge.com').toLowerCase().trim();
    const adminPass = (process.env.ADMIN_PASSWORD || 'Admin@2026').trim();
    const adminName = (process.env.ADMIN_NAME || 'Admin').trim();

    // Support literal variable names if entered in form
    if (cleanEmail === 'superadmin_email' || cleanEmail === '"superadmin_email"') {
      cleanEmail = superEmail;
    }
    if (rawPassword === 'SUPERADMIN_PASSWORD' || rawPassword === '"SUPERADMIN_PASSWORD"') {
      rawPassword = superPass;
    }
    if (cleanEmail === 'admin_email' || cleanEmail === '"admin_email"') {
      cleanEmail = adminEmail;
    }
    if (rawPassword === 'ADMIN_PASSWORD' || rawPassword === '"ADMIN_PASSWORD"') {
      rawPassword = adminPass;
    }

    // ── Super Admin fast-path authentication ──
    if (cleanEmail === superEmail && rawPassword === superPass) {
      if (getIsConnected()) {
        let user = await User.findOne({ email: superEmail });
        if (!user) {
          const hashedPassword = await bcrypt.hash(superPass, 10);
          user = await User.create({
            name: superName,
            email: superEmail,
            password: hashedPassword,
            role: 'superadmin',
            provider: 'email',
          });
        } else {
          let needsSave = false;
          if (user.role !== 'superadmin') { user.role = 'superadmin'; needsSave = true; }
          // Sync name from .env if it was changed
          if (superName && user.name !== superName) { user.name = superName; needsSave = true; }
          if (needsSave) await user.save();
        }
        const token = generateToken(user._id.toString(), user.email, user.name, user.role);
        return res.json({ success: true, token, user: sanitizeUser(user) });
      } else {
        const memUser = { id: 'superadmin_id', name: superName, email: superEmail, role: 'superadmin' };
        const token = generateToken(memUser.id, memUser.email, memUser.name, memUser.role);
        return res.json({ success: true, token, user: memUser });
      }
    }

    // ── Regular Admin fast-path authentication ──
    if (cleanEmail === adminEmail && rawPassword === adminPass) {
      if (getIsConnected()) {
        let user = await User.findOne({ email: adminEmail });
        if (!user) {
          const hashedPassword = await bcrypt.hash(adminPass, 10);
          user = await User.create({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            provider: 'email',
          });
        } else {
          let needsSave = false;
          if (user.role !== 'admin' && user.role !== 'superadmin') { user.role = 'admin'; needsSave = true; }
          // Sync name from .env if it was changed
          if (adminName && user.name !== adminName) { user.name = adminName; needsSave = true; }
          if (needsSave) await user.save();
        }
        const token = generateToken(user._id.toString(), user.email, user.name, user.role);
        return res.json({ success: true, token, user: sanitizeUser(user) });
      } else {
        const memUser = { id: 'admin_id', name: adminName, email: adminEmail, role: 'admin' };
        const token = generateToken(memUser.id, memUser.email, memUser.name, memUser.role);
        return res.json({ success: true, token, user: memUser });
      }
    }

    // 1. MongoDB Mode
    if (getIsConnected()) {
      const user = await User.findOne({ email: cleanEmail });
      if (!user || !user.password) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const matches = await bcrypt.compare(rawPassword, user.password);
      if (!matches) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // Check if user is an admin or superadmin — regular users cannot log in to admin dashboard
      const isSuper = user.role === 'superadmin' || cleanEmail === superEmail;
      const isAdmin = user.role === 'admin' || cleanEmail === adminEmail;
      if (!isSuper && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only Admins and Super Admins can log in to the admin dashboard.',
        });
      }

      if (user.status === 'restricted') {
        const reasonPart = user.statusReason ? `\nReason: ${user.statusReason}` : '';
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_RESTRICTED',
          message: `Your account has been suspended by administration.${reasonPart}`,
        });
      }

      if (user.status === 'revoked') {
        const reasonPart = user.statusReason ? `\nReason: ${user.statusReason}` : '';
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_REVOKED',
          message: `Your account has been permanently terminated (Revoked) by administration.${reasonPart}`,
        });
      }

      const token = generateToken(user._id.toString(), user.email, user.name, user.role);
      createUserDatabase(user).catch(() => {});
      return res.json({ success: true, token, user: sanitizeUser(user) });
    }

    // 2. In-Memory Fallback
    const user = MEMORY_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const matches = await bcrypt.compare(rawPassword, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check if user is an admin or superadmin — regular users cannot log in to admin dashboard
    const isSuper = user.role === 'superadmin' || cleanEmail === superEmail;
    const isAdmin = user.role === 'admin' || cleanEmail === adminEmail;
    if (!isSuper && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins and Super Admins can log in to the admin dashboard.',
      });
    }

    const token = generateToken(user.id, user.email, user.name, user.role);
    return res.json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'idToken is required' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      const decoded = jwt.decode(idToken);
      if (decoded && decoded.email) {
        payload = decoded;
      } else {
        return res.status(401).json({ success: false, message: 'Invalid Google token' });
      }
    }

    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const displayName = payload.name || cleanEmail.split('@')[0];
    const photoUrl = payload.picture || null;

    // 1. MongoDB Mode
    if (getIsConnected()) {
      let user = await User.findOne({ email: cleanEmail });
      if (!user) {
        user = await User.create({
          name: displayName,
          email: cleanEmail,
          photo: photoUrl,
          provider: 'google',
          googleId: payload.sub || null,
        });
      } else if (photoUrl && !user.photo) {
        user.photo = photoUrl;
        await user.save();
      }

      const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@probridge.com').toLowerCase().trim();
      const isSuper = user.role === 'superadmin' || cleanEmail === superEmail;
      const isAdmin = user.role === 'admin' || cleanEmail === adminEmail;
      if (!isSuper && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only Admins and Super Admins can log in to the admin dashboard.',
        });
      }

      const token = generateToken(user._id.toString(), user.email, user.name, user.role);
      createUserDatabase(user).catch(() => {});
      return res.json({ success: true, token, user: sanitizeUser(user) });
    }

    // 2. In-Memory Fallback
    let user = MEMORY_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      user = {
        id: `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: displayName,
        email: cleanEmail,
        photo: photoUrl,
        provider: 'google',
        role: 'user',
        createdAt: new Date().toISOString(),
      };
      MEMORY_USERS.push(user);
    } else if (photoUrl && !user.photo) {
      user.photo = photoUrl;
    }

    const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@probridge.com').toLowerCase().trim();
    const isSuper = user.role === 'superadmin' || cleanEmail === superEmail;
    const isAdmin = user.role === 'admin' || cleanEmail === adminEmail;
    if (!isSuper && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins and Super Admins can log in to the admin dashboard.',
      });
    }

    const token = generateToken(user.id, user.email, user.name, user.role);
    return res.json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@probridge.com').toLowerCase().trim();

    if (getIsConnected()) {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const isSuper = user.role === 'superadmin' || (user.email || '').toLowerCase() === superEmail;
      const isAdmin = user.role === 'admin' || (user.email || '').toLowerCase() === adminEmail;
      if (!isSuper && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
      }
      return res.json({ success: true, user: sanitizeUser(user) });
    }

    const user = MEMORY_USERS.find((u) => u.id === req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isSuper = user.role === 'superadmin' || (user.email || '').toLowerCase() === superEmail;
    const isAdmin = user.role === 'admin' || (user.email || '').toLowerCase() === adminEmail;
    if (!isSuper && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }
    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// In-memory OTP storage: phone -> { otp, sessionInfo, provider, expiresAt }
const OTP_STORE = new Map();

// POST /api/auth/send-otp (Send OTP for phone registration with Firebase Phone Auth support)
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, firebaseToken } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number' });
    }

    // 1. Try Firebase Phone Verification first if token is configured
    const tokenToUse = firebaseToken || process.env.FIREBASE_PHONE_TOKEN;
    if (tokenToUse) {
      const fbResult = await sendFirebaseVerificationCode(cleanPhone, tokenToUse);
      if (fbResult.success && fbResult.sessionInfo) {
        console.log(`\n🔥 [Firebase Phone Service] Real SMS verification initiated for +91 ${cleanPhone}`);
        const expiresAt = Date.now() + 5 * 60 * 1000;
        OTP_STORE.set(cleanPhone, {
          provider: 'firebase',
          sessionInfo: fbResult.sessionInfo,
          expiresAt,
        });

        return res.json({
          success: true,
          provider: 'firebase',
          message: `Firebase SMS verification code sent to +91 ${cleanPhone}`,
          expiresIn: 300,
        });
      }

      console.warn(`\n⚠️ [Firebase Phone Warning] ${fbResult.error || 'Failed to send SMS code'}`);
      if (fbResult.error && fbResult.error.includes('OPERATION_NOT_ALLOWED')) {
        console.warn('👉 Tip: Enable Phone provider in Firebase Console: Authentication > Sign-in method > Phone > Enable');
      }
    }

    // 2. Fallback / Dev OTP generation
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    OTP_STORE.set(cleanPhone, {
      provider: 'local',
      otp,
      expiresAt,
    });
    console.log(`\n📲 [OTP Service] OTP generated for +91 ${cleanPhone}: [ ${otp} ] (Valid for 5 mins)\n`);

    return res.json({
      success: true,
      provider: 'local',
      message: `Verification code sent to +91 ${cleanPhone}`,
      expiresIn: 300,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/verify-otp (Verify OTP and register phone number)
router.post('/verify-otp', optionalAuth, async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const record = OTP_STORE.get(cleanPhone);

    if (!record) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this number or it has expired' });
    }

    if (Date.now() > record.expiresAt) {
      OTP_STORE.delete(cleanPhone);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please tap "Resend OTP".' });
    }

    let isVerified = false;
    const providerUsed = record.provider || 'local';

    if (record.provider === 'firebase' && record.sessionInfo) {
      const fbVerify = await verifyFirebaseOtpCode(record.sessionInfo, otp);
      if (fbVerify.success) {
        isVerified = true;
      } else {
        // Fallback check if test otp matches
        if (record.otp && record.otp === String(otp).trim()) {
          isVerified = true;
        } else {
          return res.status(400).json({
            success: false,
            message: fbVerify.error || 'Invalid Firebase verification code. Please check SMS and try again.',
          });
        }
      }
    } else {
      if (record.otp !== String(otp).trim()) {
        return res.status(400).json({ success: false, message: 'Invalid OTP. Please check the code and try again.' });
      }
      isVerified = true;
    }

    if (!isVerified) {
      return res.status(400).json({ success: false, message: 'OTP verification failed.' });
    }

    // Verified! Clean up OTP record
    OTP_STORE.delete(cleanPhone);

    // If authenticated, update user in MongoDB
    let updatedUser = null;
    if (req.userId && getIsConnected()) {
      updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { phone: cleanPhone, phoneVerified: true },
        { new: true }
      );
    }

    return res.json({
      success: true,
      verified: true,
      provider: providerUsed,
      message: 'Phone number verified successfully! 🎉',
      phone: cleanPhone,
      user: updatedUser ? sanitizeUser(updatedUser) : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/auth/profile (Update name, photo, phone, etc.)
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { name, photo, phone, phoneVerified } = req.body;
    const userId = req.userId;

    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof photo === 'string') updates.photo = photo.trim();
    if (typeof phone === 'string') updates.phone = phone.replace(/[^0-9]/g, '').slice(-10);
    if (typeof phoneVerified === 'boolean') updates.phoneVerified = phoneVerified;

    if (getIsConnected()) {
      const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({
        success: true,
        message: 'Profile updated successfully 🎉',
        user: sanitizeUser(user),
      });
    }

    // Memory fallback
    const user = MEMORY_USERS.find((u) => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    Object.assign(user, updates);
    return res.json({
      success: true,
      message: 'Profile updated successfully 🎉',
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
