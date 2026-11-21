const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
  const password = args[1] || process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@2026';
  const name = args[2] || 'Super Admin';

  if (!email || !password) {
    console.log('Usage: node scripts/setSuperAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in Backend/.env');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri);

  const hashedPassword = await bcrypt.hash(password, 10);
  let user = await User.findOne({ email });

  if (user) {
    user.name = name || user.name;
    user.password = hashedPassword;
    user.role = 'superadmin';
    await user.save();
    console.log(`\n👑 Super Admin updated successfully!`);
    console.log(`   Email:    ${user.email}`);
    console.log(`   Role:     ${user.role}`);
    console.log(`   Password: (updated to provided password)\n`);
  } else {
    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'superadmin',
      phone: '9999999999',
      phoneVerified: true,
      provider: 'email',
    });
    console.log(`\n👑 New Super Admin created successfully!`);
    console.log(`   Email:    ${user.email}`);
    console.log(`   Role:     ${user.role}`);
    console.log(`   Password: ${password}\n`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

