# Backend changes needed for the admin website

I read `Backend/src` in your zip. The admin website works in demo mode with no backend changes.
To use it with your real data (`VITE_USE_MOCK=false`) your backend needs the changes below.
This folder does **not** modify your backend. Apply them yourself and test them.

## What your backend has today

| Need | Today | 
|---|---|
| Admin account | No `role` on the User model, so nobody can be an admin |
| Approval before publishing | No approval field. `POST /api/properties` saves `status: 'active'`, so listings go live immediately |
| List all properties for admin | `GET /api/properties` returns only `status: 'active'` |
| List / delete users | No endpoints |
| Admin edit / delete property | `PATCH` / `DELETE /api/properties/:id` return 403 unless you are the owner |

## 1. Admin role

`models/User.js`: add to the schema

```js
role: { type: String, enum: ['user', 'admin'], default: 'user' },
```

Make yourself admin once, in MongoDB (collection `User Details`):

```js
db["User Details"].updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

New file `middleware/requireAdmin.js`:

```js
const requireAuth = require('./requireAuth');
const User = require('../models/User');

module.exports = [
  requireAuth,
  async (req, res, next) => {
    const u = await User.findById(req.userId).select('role');
    if (!u || u.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access only' });
    req.isAdmin = true;
    next();
  },
];
```

The admin website checks `user.role === 'admin'` after login, so `routes/auth.js` must return `role`.
It already does if you keep `sanitizeUser` as it is (it returns every field except the password).

## 2. Approval fields

`models/Property.js`: add

```js
approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
rejectionReason: { type: String, default: '' },
reviewedAt: { type: Date },
```

The default is `approved` on purpose: your existing listings have no such field and must stay visible.
Only **new listings from app users** become `pending` (next step).

## 3. New listings from the app start as pending

`routes/properties.js`, in `POST /` where `newPropertyData` is built, add:

```js
approvalStatus: req.isAdmin ? 'approved' : 'pending',
```

(`req.isAdmin` comes from step 5.) Optionally show "Under review" in the app for the owner's `my-listings`.

## 4. Hide unapproved listings from the public app

Everywhere the public routes filter on `status: 'active'` (`GET /`, `/city-counts`, `/category-counts`), add:

```js
approvalStatus: { $nin: ['pending', 'rejected'] }
```

Use `$nin`, not `'approved'`. Old documents without the field must still match.
`GET /:id` should also return 404 for pending/rejected unless the requester is the owner or an admin.

## 5. Let the admin edit and delete any property

In `routes/properties.js`, for `POST /`, `PATCH /:id` and `DELETE /:id`:

1. Replace `optionalAuth` with `requireAuth`. **This also fixes a security hole:** today, with no token, anyone can PATCH or DELETE any property, because the ownership check is skipped when `req.userId` is empty.
2. Add `isAdmin` detection. Simplest is a small middleware after `requireAuth` that sets `req.isAdmin` from the user's role (same query as `requireAdmin`, but without rejecting).
3. Ownership checks become: `if (!req.isAdmin && prop.owner && String(prop.owner) !== String(req.userId)) return 403`.
4. In `POST /`: skip the phone-verified check when `req.isAdmin`, and keep the `ownerName` / `ownerEmail` sent by the form instead of overwriting them with the admin's own name.
5. In `PATCH /:id`, the `updates` object currently ignores some fields the admin form sends. Add:

```js
status: data.status || prop.status,                                   // archive / sold / rented
ownerName: data.ownerName !== undefined ? data.ownerName : prop.ownerName,
ownerEmail: data.ownerEmail !== undefined ? data.ownerEmail : prop.ownerEmail,
// when an app user edits an approved listing, send it back for review:
...(req.isAdmin ? {} : { approvalStatus: 'pending' }),
```

## 6. New admin routes

New file `routes/admin.js`, mounted in `server.js` with `app.use('/api/admin', require('./routes/admin'));`

```js
const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const User = require('../models/User');
const requireAdmin = require('../middleware/requireAdmin');

router.use(requireAdmin);

// All properties, any status or approval state
router.get('/properties', async (req, res) => {
  const list = await Property.find().sort({ createdAt: -1 }).populate('owner', 'name email photo');
  res.json({ success: true, count: list.length, results: list.map((p) => p.toJSON()) });
});

// Approve or reject:  { action: 'approve' | 'reject', remarks: '...' }
router.patch('/properties/:id/approval', async (req, res) => {
  const { action, remarks } = req.body || {};
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid action' });
  if (action === 'reject' && !String(remarks || '').trim())
    return res.status(400).json({ success: false, message: 'Rejection remarks are required' });
  const p = await Property.findByIdAndUpdate(
    req.params.id,
    { $set: { approvalStatus: action === 'approve' ? 'approved' : 'rejected', rejectionReason: action === 'reject' ? remarks.trim() : '', reviewedAt: new Date() } },
    { new: true }
  );
  if (!p) return res.status(404).json({ success: false, message: 'Property not found' });
  res.json({ success: true, result: p.toJSON() });
});

// All users (password is stripped by the model's toJSON)
router.get('/users', async (req, res) => {
  const list = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, results: list.map((u) => u.toJSON()) });
});

// Remove a user
router.delete('/users/:id', async (req, res) => {
  if (String(req.params.id) === String(req.userId))
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  const u = await User.findByIdAndDelete(req.params.id);
  if (!u) return res.status(404).json({ success: false, message: 'User not found' });
  await Property.deleteMany({ owner: u._id }); // decide: remove their listings too? Remove this line to keep them.
  // Also clean up SavedProperty / Notification documents for this user if you want no orphans.
  res.json({ success: true, message: 'User removed' });
});

module.exports = router;
```

Add basic error handling (try/catch) the same way your other routes do. I kept the snippet short.

## 7. Smaller things I noticed

- `CORS`: `app.use(cors())` already allows the admin site on another port. Restrict it to your admin URL before going live.
- `middleware/optionalAuth.js` has a hard-coded fallback JWT secret (`probridge_jwt_secret_dev_key_2026`), and `routes/auth.js` has the same fallback. If `JWT_SECRET` is ever missing, anyone who read this code could forge an admin token. Remove the fallback and fail on startup instead.
- Your zip contained `.env` files and `google-services.json`. I did not open the `.env` files. Make sure they are in `.gitignore` and were never pushed to GitHub. If they were, rotate the secrets.
- Images: the app sends image URIs. If those are phone-local (`file://`) paths, other devices and this website cannot display them. The admin form accepts hosted image links, or small uploaded files stored inside the listing (this needs `express.json({ limit: '10mb' })` in `server.js`). For production, use image hosting (Cloudinary, S3, etc.).
