// lib/mongodb.js — Shared MongoDB connection for Vercel serverless functions
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saurabh:SAURABH@cluster0.4rifvig.mongodb.net/portfolio?retryWrites=true&w=majority&appName=Cluster0';


// Cache the connection in global to reuse across warm serverless invocations
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    }).then(m => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
