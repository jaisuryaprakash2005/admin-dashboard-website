# ProBridge Admin (React + JavaScript)

Admin website for the ProBridge real estate app: a dashboard for users and properties,
property create / edit / archive / delete, user removal, and an approval queue for
properties that users submit from the app.

## Run it

```bash
cd admin-dashboard
npm install
cp .env.example .env     # on Windows: copy .env.example .env
npm run dev
```

Open http://localhost:5173. In demo mode (the default) any email and password sign you in.

## Demo mode vs real backend

| `.env` | Behaviour |
|---|---|
| `VITE_USE_MOCK=true` | Sample data in the browser. Nothing is saved anywhere. A banner says so. |
| `VITE_USE_MOCK=false` | Calls your backend at `VITE_API_BASE_URL`. Requires the changes in **BACKEND_CHANGES.md**. |

All server calls go through `src/services/adminService.js` (real calls in one object, demo data in
`src/services/mockApi.js`). Each real call is marked `exists` or `NEW`.

## Pages

- **Dashboard**: user and property summaries, charts, recent items, pending approvals
- **User Management**: search, filters, sort, view details, remove user (with confirmation)
- **Property Management**: table or grid, search, filters, sort, view, edit, archive, delete
- **Add / Edit Property**: fields and options match the mobile app's listing form
- **Property Approvals**: pending / approved / rejected, review images, approve or reject with remarks

## Notes

- Search, filter, sort and pagination run in the browser over the full list. Fine for thousands of
  records. If your data grows far beyond that, move them to the server.
- The login screen and route guard only hide pages. **The backend must enforce admin-only access**
  on every admin route (see BACKEND_CHANGES.md).
- Not included yet: analytics page, settings page, editing user details (your User model has no
  role or status to edit besides name, phone and photo).
- This project was written without being able to run `npm install` or build it, so expect to fix a small
  mistake or two on first run.
