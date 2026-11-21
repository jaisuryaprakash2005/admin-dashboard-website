const mongoose = require('mongoose');

let isConnected = false;

mongoose.connection.on('connected', () => { isConnected = true; });
mongoose.connection.on('open', () => { isConnected = true; });
mongoose.connection.on('disconnected', () => { isConnected = false; });
mongoose.connection.on('error', () => { isConnected = false; });

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.log('\n⚠️  MongoDB URI not configured in .env');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    console.log(`\n🍃 MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database Name: ${conn.connection.name}\n`);
    return true;
  } catch (err) {
    console.error('\n❌ MongoDB Connection Error:', err.message);
    isConnected = false;
    return false;
  }
}

function getIsConnected() {
  return mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2 || isConnected;
}

module.exports = { connectDB, getIsConnected };
