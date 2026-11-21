// ─── ProBridge Admin Management Script ────────────────────────────────────────
// Usage:
//   node scripts/makeAdmin.js <email> <password> [name]   -> Create a new admin directly
//   node scripts/makeAdmin.js <email>                     -> Promote existing user to admin
//   node scripts/makeAdmin.js <email> remove              -> Demote admin back to normal user

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const secondArg = (process.argv[3] || '').trim();
  const nameArg = (process.argv[4] || '').trim() || (email.split('@')[0] || 'Admin');

  if (!email || !email.includes('@')) {
    console.error('Usage:');
    console.error('  Create new admin:     node scripts/makeAdmin.js <email> <password> [name]');
    console.error('  Promote existing user: node scripts/makeAdmin.js <email>');
    console.error('  Remove admin role:     node scripts/makeAdmin.js <email> remove');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is missing in .env');
    process.exit(1);
  }

  const isRemove = secondArg.toLowerCase() === 'remove';
  const hasPassword = secondArg && !isRemove;

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

    let user = await User.findOne({ email });

    if (user) {
      // User exists
      if (isRemove) {
        user.role = 'user';
        await user.save();
        console.log(`✅ ${user.email} is now demoted to normal user.`);
      } else {
        user.role = 'admin';
        if (hasPassword) {
          user.password = await bcrypt.hash(secondArg, 10);
          console.log(`🔑 Password updated for ${user.email}`);
        }
        await user.save();
        console.log(`\n🎉 Success! User ${user.email} is now an ADMIN.`);
        console.log(`   You can now log in at: http://localhost:5173\n`);
      }
    } else {
      // User does not exist yet
      if (isRemove) {
        console.error(`❌ No user found with email ${email}.`);
        process.exitCode = 1;
      } else if (hasPassword) {
        // Automatically CREATE the admin user!
        const hashedPassword = await bcrypt.hash(secondArg, 10);
        user = await User.create({
          name: nameArg,
          email,
          password: hashedPassword,
          role: 'admin',
          provider: 'email',
          phoneVerified: true,
        });
        console.log(`\n🎉 Success! New ADMIN account created!`);
        console.log(`   Email:    ${user.email}`);
        console.log(`   Role:     ${user.role}`);
        console.log(`   Login at: http://localhost:5173\n`);
      } else {
        console.log(`⚠️  No user found with email ${email}.`);
        console.log(`💡 To create this user as an admin now, provide a password:`);
        console.log(`   node scripts/makeAdmin.js ${email} <password>`);
        process.exitCode = 1;
      }
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
