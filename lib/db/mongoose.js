import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('Warning: MONGODB_URI is not set in .env.');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, lastFailedAt: 0 };
}

export async function connectToDatabase() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Fast Circuit Breaker: If connection failed within the last 15 seconds, fail immediately in 0ms
  const now = Date.now();
  if (cached.lastFailedAt && now - cached.lastFailedAt < 15000) {
    throw new Error('Database connection currently unavailable (circuit-breaker fast-fail)');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    };

    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/80-20-outbound';

    cached.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        console.log('[Database] Connected to MongoDB successfully.');
        cached.lastFailedAt = 0;
        return mongooseInstance;
      })
      .catch((err) => {
        cached.promise = null;
        cached.lastFailedAt = Date.now();
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.lastFailedAt = Date.now();
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
