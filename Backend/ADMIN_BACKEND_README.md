# Admin backend for the ProBridge admin website (Node.js + Express + MongoDB)

These files add admin support to your existing backend. They are **changes to your current code, not a new server**:
your app and the admin website share one backend and one database.

I could not run this here (no database and no npm access in my sandbox). Every file passes a Node syntax check,
but it is untested. Commit your current code to git first, apply these files, and test with the steps below.

## 1. Files

New files (copy into your `Backend` folder, same paths):

| File | Purpose |
|---|---|
| `src/routes/admin.js` | Admin API: list all properties, approve/reject, list users, delete user |
| `src/middleware/requireAdmin.js` | Only lets users with role `admin` through |
| `src/middleware/attachAdmin.js` | Sets `req.isAdmin` from the role stored in the database |
| `scripts/makeAdmin.js` | Makes (or un-makes) a user an admin |

Changed files (**they replace the originals**, so if you changed these files after sending me your zip,
merge by hand using `CHANGES.diff` instead of copying):

`src/server.js`, `src/models/User.js`, `src/models/Property.js`, `src/routes/properties.js`,
`src/routes/auth.js`, `src/middleware/optionalAuth.js`

## 2. Set up

1. Copy the files in. No new npm packages are needed.
2. Optional `.env` lines:
   ```
   ADMIN_ORIGIN=http://localhost:5173        # admin site URL(s), comma separated. Set this in production.
   ADMIN_DROP_USER_DB=false                  # true = also drop a deleted user's dedicated database
   ```
3. Create your admin. Register an account in the app **with email and password** (Google-only accounts have no
   password and cannot sign in to the admin site), then:
   ```bash
   cd Backend
   node scripts/makeAdmin.js you@example.com
   ```
4. Restart the backend (`npm run dev`). Then in the admin website set `VITE_USE_MOCK=false` and
   `VITE_API_BASE_URL=http://localhost:5000`.

## 3. Endpoints

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | Existing. Returns `user.role`, which the admin site checks |
| GET | `/api/admin/properties` | admin | All properties; optional `?approvalStatus=pending` |
| PATCH | `/api/admin/properties/:id/approval` | admin | Body `{ "action": "approve" }` or `{ "action": "reject", "remarks": "..." }`. Also sends the owner an in-app notification |
| GET | `/api/admin/users` | admin | All users (no passwords) |
| DELETE | `/api/admin/users/:id` | admin | Removes the user, their listings, saved items and notifications. Cannot delete yourself or another admin |
| POST | `/api/properties` | existing | Admin: published at once, no phone check, keeps the seller name you typed. App user: saved as `pending` |
| PATCH / DELETE | `/api/properties/:id` | existing | Now need a login token. Owner or admin only |

## 4. Behaviour changes in your app (please read)

- **New listings from the app are `pending` and hidden** from Home, search and counts until you approve them.
  The create response now includes `pendingApproval: true`. The app does not use it yet. You may want to show
  "Submitted for review" instead of "Listed". The owner still sees the listing in My Listings.
- **Existing listings stay visible.** Documents without `approvalStatus` are treated as approved.
- **Owner edits go back to `pending`.** This stops someone getting an innocent listing approved and then editing it.
  To turn it off, delete the `{ approvalStatus: 'pending', rejectionReason: '' }` line in the PATCH handler.
- **PATCH / DELETE of a property now require login.** Before, a request with no token could edit or delete anyone's property.
  Listings with no owner (created by guests) can now only be changed by an admin.
- **Pending/rejected listings** return 404 from `GET /api/properties/:id` for everyone except the owner and admins.
- **Server will not start without `JWT_SECRET`.** I removed the hard-coded fallback secret from the code.
  Your `.env` already has one, so nothing changes for you.
- **JSON body limit is 10 MB** (default was 100 KB) so the admin form can embed small uploaded images.
  Prefer hosted image links in production.
- `phone` entered in the admin form is not saved: your Property schema has no `phone` field, and adding one would
  expose seller numbers on public listing responses. Decide on that separately.

## 5. Quick test

```bash
# 1. Log in as the admin and copy the token
curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YOUR_PASSWORD"}'

# 2. Admin list (should work)
curl -s http://localhost:5000/api/admin/properties -H "Authorization: Bearer TOKEN"

# 3. Same call without a token, or with a normal user's token (should be 401 / 403)
curl -i http://localhost:5000/api/admin/properties
```

Then: post a property from the app, confirm it is missing from Home, find it in the admin site's Approvals page,
approve it, and confirm it now appears in the app and the owner gets a notification.

## 6. Still recommended before going live

- Serve the backend over HTTPS and set `ADMIN_ORIGIN`.
- Add login rate limiting (for example `express-rate-limit` on `/api/auth/login`).
- Rotate any secret that was ever committed to GitHub (`.env`, `google-services.json`).
