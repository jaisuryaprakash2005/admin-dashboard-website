// One-time script to create/promote an admin user directly in the database.
// Usage: node scripts/createAdmin.js <email> <password>
// Example: node scripts/createAdmin.js jai@gmail.com 1234567

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const email = (process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || '';

if (!email || !password) {
  console.error('Usage: node scripts/createAdmin.js <email> <password>');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing in Backend/.env');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB');

    const hashed = await bcrypt.hash(password, 10);
    const existing = await User.findOne({ email });

    if (existing) {
      existing.role = 'admin';
      existing.password = hashed;
      await existing.save();
      console.log(`✅ User updated: ${email} is now an admin with role: ${existing.role}`);
    } else {
      const created = await User.create({
        name: 'Admin',
        email,
        password: hashed,
        role: 'admin',
        provider: 'email',
        phoneVerified: true,
      });
      console.log(`✅ Admin account created: ${created.email} (role: ${created.role}) in 'User Details' collection`);
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
