require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./src/routes/auth');
const propertyRoutes = require('./src/routes/properties');
const adminRoutes = require('./src/routes/admin');
const uploadRoutes = require('./src/routes/upload');
const adsRoutes = require('./src/routes/ads');
const topBannersRoutes = require('./src/routes/topBanners');
const enquiriesRoutes = require('./src/routes/enquiries');
const careersRoutes = require('./src/routes/careers');
const buildersRoutes = require('./src/routes/builders');

const app = express();
const PORT = process.env.PORT || 5000;

// ─€─€ Middleware ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─€─€ Routes ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/top-banners', topBannersRoutes);
app.use('/api/enquiries', enquiriesRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/builders', buildersRoutes);

app.get('/', (_req, res) => res.json({ message: 'ProBridge API running ✅' }));

// ─€─€ Connect DB & Start ─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€─€
if (!process.env.MONGODB_URI) {
  console.error('âŒ  MONGODB_URI is not set in Backend/.env');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('âŒ  JWT_SECRET is not set in Backend/.env');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('âŒ MongoDB connection failed:', err.message);
    process.exit(1);
  });

