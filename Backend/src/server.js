const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // must be first so process.env is filled before other files read it
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

const searchRouter     = require('./routes/search');
const filtersRouter    = require('./routes/filters');
const localitiesRouter = require('./routes/localities');
const authRouter          = require('./routes/auth');
const propertiesRouter    = require('./routes/properties');
const savedRouter         = require('./routes/saved');
const notificationsRouter = require('./routes/notifications');
const adminRouter         = require('./routes/admin');
const uploadRouter        = require('./routes/upload');
const adsRouter           = require('./routes/ads');
const topBannersRouter    = require('./routes/topBanners');
const buildersRouter      = require('./routes/builders');
const careersRouter       = require('./routes/careers');

if (!process.env.JWT_SECRET) {
  console.error('âŒ JWT_SECRET is missing in Backend/.env. Refusing to start without it.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// ─€─€─€ Middleware ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
app.use(cors({ origin: process.env.ADMIN_ORIGIN ? process.env.ADMIN_ORIGIN.split(',') : true })); // set ADMIN_ORIGIN in production, e.g. https://admin.yourdomain.com           // Allow React Native / Expo dev client to call this API
app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies (10mb: admin form can embed small uploaded images)

// ─€─€─€ Routes ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'ProBridge API is running 🚀' });
});

// City search autocomplete  â†’  GET /api/search/cities?q=ch
app.use('/api/search/cities', searchRouter);

// Filter options            â†’  GET /api/filters
//                           â†’  GET /api/filters/types
//                           â†’  GET /api/filters/budgets
app.use('/api/filters', filtersRouter);

// City names search         â†’  GET /api/localities/cities?q=ban
// Locality search in city   â†’  GET /api/localities?city=Bangalore&q=white
app.use('/api/localities', localitiesRouter);

// Auth                      â†’  POST /api/auth/register | /login | /google
//                           â†’  GET  /api/auth/me
app.use('/api/auth', authRouter);

// Properties                â†’  GET  /api/properties (all active)
//                           â†’  GET  /api/properties/my-listings
//                           â†’  POST /api/properties (create)
//                           â†’  DELETE /api/properties/:id
app.use('/api/properties', propertiesRouter);

// Saved Properties          â†’  GET  /api/saved (current user's saved properties)
//                           â†’  POST /api/saved/toggle (toggle in 'Save Properties' collection)
//                           â†’  DELETE /api/saved/:propertyId
app.use('/api/saved', savedRouter);

// Notifications             â†’  GET  /api/notifications (current user's notifications)
//                           â†’  POST /api/notifications (send like / enquiry notification)
//                           â†’  PATCH /api/notifications/:id/read
//                           â†’  POST /api/notifications/read-all
app.use('/api/notifications', notificationsRouter);

// Admin (requires a user with role 'admin')
//                           â†’  GET    /api/admin/properties
//                           â†’  PATCH  /api/admin/properties/:id/approval
//                           â†’  GET    /api/admin/users
//                           â†’  DELETE /api/admin/users/:id
app.use('/api/admin', adminRouter);

// Image upload              â†’  POST /api/upload/image
app.use('/api/upload', uploadRouter);

// Ads                       â†’  GET  /api/ads/active | POST /api/ads/:id/click
app.use('/api/ads', adsRouter);

// Standalone Top Banners     â†’  GET  /api/top-banners | POST /api/top-banners/:id/click
app.use('/api/top-banners', topBannersRouter);
app.use('/api/builders', buildersRouter);
app.use('/api/careers', careersRouter);
app.use('/api/admin/careers-proxy', careersRouter);

// ─€─€─€ 404 Handler ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─€─€─€ Global Error Handler ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const os = require('os');
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ─€─€─€ Start ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
async function startServer() {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`\n✅  ProBridge API running on http://0.0.0.0:${PORT}`);
    console.log(`   Android device URL â†’ http://${localIp}:${PORT}`);
    console.log(`   City search (TN)  â†’  GET /api/search/cities?q=ch`);
    console.log(`   All filters       â†’  GET /api/filters`);
    console.log(`   City names        â†’  GET /api/localities/cities?q=ban`);
    console.log(`   Localities        â†’  GET /api/localities?city=Bangalore&q=white`);
    console.log(`   Properties        â†’  GET /api/properties | POST /api/properties\n`);
  });
}

startServer();

module.exports = app;

